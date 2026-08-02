import { Point, PhotoQuad } from '../types';
import {
  AnyCanvas,
  DrawableSource,
  createCanvas,
  get2d,
  canvasToBlob as encodeCanvas
} from './canvasCompat';
import {
  convexHull,
  distance,
  minAreaRect,
  orderQuadPoints,
  polygonArea,
  quadContainment,
  solveHomography,
  applyHomography
} from './geometry';

export { distance, orderQuadPoints, quadIoU } from './geometry';

/** Working resolution for detection. Big enough for accurate corners, small enough to stay fast. */
const DETECT_MAX_DIM = 900;

/** Coarse grid used to find connected photo regions before refining their corners. */
const GRID = 96;

/** Refuse to allocate an output larger than this on either axis. */
const MAX_OUTPUT_DIM = 8000;

/**
 * Estimates the sheet background colour from its border.
 *
 * Samples a ring of points around the edge of the sheet and takes the
 * per-channel *median*. A mean over four corner patches - the previous
 * approach - is destroyed by a single photo overlapping one corner, which is
 * extremely common on a full album page. The median tolerates up to half the
 * border being covered.
 */
function estimateBackground(pixels: Uint8ClampedArray, w: number, h: number): [number, number, number] {
  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];

  const inset = Math.max(2, Math.floor(Math.min(w, h) * 0.01));
  const step = Math.max(1, Math.floor(Math.max(w, h) / 200));

  const sample = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const idx = (y * w + x) * 4;
    rs.push(pixels[idx]);
    gs.push(pixels[idx + 1]);
    bs.push(pixels[idx + 2]);
  };

  for (let x = 0; x < w; x += step) {
    sample(x, inset);
    sample(x, h - 1 - inset);
  }
  for (let y = 0; y < h; y += step) {
    sample(inset, y);
    sample(w - 1 - inset, y);
  }

  if (rs.length === 0) return [240, 240, 240];

  const median = (arr: number[]) => {
    arr.sort((a, b) => a - b);
    return arr[Math.floor(arr.length / 2)];
  };

  return [median(rs), median(gs), median(bs)];
}

/**
 * Fills isolated background cells that are almost entirely surrounded by
 * foreground, smoothing speckle out of the mask.
 *
 * Deliberately *not* a morphological closing. Closing dilates before eroding,
 * and dilation bridges any gap narrower than its kernel - which merges photos
 * sitting close together on a page, the single most common album layout, and
 * once the bridge exists erosion cannot separate them again. Requiring a strong
 * majority of foreground neighbours removes noise without ever growing a region
 * into its neighbour: a cell in the corridor between two photos has foreground
 * on two sides at most, so it is left alone.
 *
 * Interior detail matching the page colour is handled by fillHoles below, which
 * is exact rather than kernel-limited.
 */
function despeckle(grid: Uint8Array, cols: number, rows: number): Uint8Array {
  const out = new Uint8Array(grid);

  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      const idx = gy * cols + gx;
      if (grid[idx] === 1) continue;

      let foreground = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = gx + dx;
          const ny = gy + dy;
          if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
          if (grid[ny * cols + nx] === 1) foreground++;
        }
      }

      // 7 of 8 means this is a pinhole, not part of a corridor between photos.
      if (foreground >= 7) out[idx] = 1;
    }
  }

  return out;
}

/**
 * Fills enclosed background regions in the occupancy grid.
 *
 * Photos routinely contain areas that match the page they sit on - a dark sea
 * band on a black album leaf, a bright sky on a white scanner bed - and those
 * areas punch straight through the mask. When the hole is wide enough it splits
 * one photo into several regions, and the leftover border strip surfaces as a
 * spurious extra "photo".
 *
 * Anything genuinely outside a photo connects to the edge of the sheet.
 * Flood-filling background inward from the border and marking whatever it
 * cannot reach as foreground therefore closes interior holes of any size, while
 * leaving the real page background untouched.
 */
function fillHoles(grid: Uint8Array, cols: number, rows: number): Uint8Array {
  const reachable = new Uint8Array(cols * rows);
  const stack: number[] = [];

  const push = (idx: number) => {
    if (grid[idx] === 0 && !reachable[idx]) {
      reachable[idx] = 1;
      stack.push(idx);
    }
  };

  for (let gx = 0; gx < cols; gx++) {
    push(gx);
    push((rows - 1) * cols + gx);
  }
  for (let gy = 0; gy < rows; gy++) {
    push(gy * cols);
    push(gy * cols + cols - 1);
  }

  while (stack.length > 0) {
    const cur = stack.pop()!;
    const cx = cur % cols;
    const cy = (cur / cols) | 0;
    if (cy > 0) push(cur - cols);
    if (cy < rows - 1) push(cur + cols);
    if (cx > 0) push(cur - 1);
    if (cx < cols - 1) push(cur + 1);
  }

  const filled = new Uint8Array(cols * rows);
  for (let i = 0; i < filled.length; i++) {
    filled[i] = grid[i] === 1 || !reachable[i] ? 1 : 0;
  }
  return filled;
}

interface Region {
  cells: number[];
  minGX: number; maxGX: number; minGY: number; maxGY: number;
}

/** Groups active grid cells into 4-connected regions. */
function findBlobs(grid: Uint8Array, cols: number, rows: number): Region[] {
  const visited = new Uint8Array(cols * rows);
  const blobs: Region[] = [];

  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      const start = gy * cols + gx;
      if (grid[start] !== 1 || visited[start]) continue;

      const cells: number[] = [];
      let minGX = gx, maxGX = gx, minGY = gy, maxGY = gy;
      const stack = [start];
      visited[start] = 1;

      while (stack.length > 0) {
        const cur = stack.pop()!;
        const cx = cur % cols;
        const cy = (cur / cols) | 0;
        cells.push(cur);

        if (cx < minGX) minGX = cx;
        if (cx > maxGX) maxGX = cx;
        if (cy < minGY) minGY = cy;
        if (cy > maxGY) maxGY = cy;

        const neighbours = [
          cy > 0 ? cur - cols : -1,
          cy < rows - 1 ? cur + cols : -1,
          cx > 0 ? cur - 1 : -1,
          cx < cols - 1 ? cur + 1 : -1
        ];
        for (const n of neighbours) {
          if (n >= 0 && !visited[n] && grid[n] === 1) {
            visited[n] = 1;
            stack.push(n);
          }
        }
      }

      blobs.push({ cells, minGX, maxGX, minGY, maxGY });
    }
  }

  return blobs;
}

/**
 * Automatic multi-photo detector for album pages and flatbed scans.
 *
 * Two stages. A coarse occupancy grid finds *where* the photos are, which is
 * robust to noise and texture. Then, for each region found, the foreground
 * pixels are collected at working resolution and reduced to their minimum-area
 * enclosing rectangle - which is where the rotation actually comes from.
 *
 * Detection previously emitted axis-aligned boxes only and never recovered a
 * photo's angle at all, so nothing in the app could deskew anything a user had
 * not hand-corrected.
 */
export async function detectPhotoQuads(
  imageElement: DrawableSource,
  sensitivity: number = 7
): Promise<PhotoQuad[]> {
  const srcW = imageElement.width;
  const srcH = imageElement.height;
  const scale = Math.min(1, DETECT_MAX_DIM / Math.max(srcW, srcH));
  const w = Math.max(1, Math.floor(srcW * scale));
  const h = Math.max(1, Math.floor(srcH * scale));

  const canvas = createCanvas(w, h);
  const ctx = get2d(canvas, { willReadFrequently: true });
  if (!ctx) return [];

  ctx.drawImage(imageElement as CanvasImageSource, 0, 0, w, h);
  const pixels = ctx.getImageData(0, 0, w, h).data;

  const [bgR, bgG, bgB] = estimateBackground(pixels, w, h);

  // Higher sensitivity => lower threshold => more pixels count as photo.
  const threshold = Math.max(14, 70 - sensitivity * 5);
  const thresholdSq = threshold * threshold;

  const isForeground = (x: number, y: number): boolean => {
    const idx = (y * w + x) * 4;
    const dr = pixels[idx] - bgR;
    const dg = pixels[idx + 1] - bgG;
    const db = pixels[idx + 2] - bgB;
    return dr * dr + dg * dg + db * db > thresholdSq;
  };

  // --- Stage 1: coarse occupancy grid -------------------------------------
  const cellW = w / GRID;
  const cellH = h / GRID;
  const occupancy = new Uint8Array(GRID * GRID);

  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      const x0 = Math.floor(gx * cellW);
      const x1 = Math.max(x0 + 1, Math.floor((gx + 1) * cellW));
      const y0 = Math.floor(gy * cellH);
      const y1 = Math.max(y0 + 1, Math.floor((gy + 1) * cellH));

      let fg = 0;
      let total = 0;
      for (let y = y0; y < y1 && y < h; y++) {
        for (let x = x0; x < x1 && x < w; x++) {
          if (isForeground(x, y)) fg++;
          total++;
        }
      }
      occupancy[gy * GRID + gx] = total > 0 && fg / total > 0.35 ? 1 : 0;
    }
  }

  const mask = fillHoles(despeckle(occupancy, GRID, GRID), GRID, GRID);
  const blobs = findBlobs(mask, GRID, GRID);

  // --- Stage 2: refine each blob into an oriented rectangle ----------------
  const minCells = Math.max(9, Math.floor(GRID * GRID * 0.004));
  const maxCells = Math.floor(GRID * GRID * 0.92);

  const quads: PhotoQuad[] = [];

  for (const blob of blobs) {
    if (blob.cells.length < minCells || blob.cells.length > maxCells) continue;
    if (blob.maxGX - blob.minGX < 3 || blob.maxGY - blob.minGY < 3) continue;

    const cellSet = new Set(blob.cells);

    // Collect foreground pixels inside this blob's cells, subsampled for speed.
    const x0 = Math.floor(blob.minGX * cellW);
    const x1 = Math.min(w, Math.ceil((blob.maxGX + 1) * cellW));
    const y0 = Math.floor(blob.minGY * cellH);
    const y1 = Math.min(h, Math.ceil((blob.maxGY + 1) * cellH));

    const step = Math.max(1, Math.floor(Math.max(x1 - x0, y1 - y0) / 320));
    const pts: Point[] = [];

    for (let y = y0; y < y1; y += step) {
      const gy = Math.min(GRID - 1, Math.floor(y / cellH));
      for (let x = x0; x < x1; x += step) {
        const gx = Math.min(GRID - 1, Math.floor(x / cellW));
        if (!cellSet.has(gy * GRID + gx)) continue;
        if (isForeground(x, y)) pts.push({ x, y });
      }
    }

    if (pts.length < 16) continue;

    const hull = convexHull(pts);
    const rect = minAreaRect(hull);
    if (!rect) continue;

    // How much of the enclosing rectangle is actually filled? A photo fills its
    // own bounding rectangle almost completely; a stray smudge or a caption
    // does not. This doubles as the confidence score, so the number shown to
    // the user finally means something instead of being a hardcoded 0.92.
    const hullArea = polygonArea(hull);
    const fill = rect.area > 0 ? Math.min(1, hullArea / rect.area) : 0;
    if (fill < 0.62) continue;

    // Reject slivers. Photos are not 12:1 strips; borders, captions and the
    // fragments left when dark photo content merges into a dark page are.
    const sideA = distance(rect.corners[0], rect.corners[1]);
    const sideB = distance(rect.corners[1], rect.corners[2]);
    const longest = Math.max(sideA, sideB);
    const shortest = Math.min(sideA, sideB);
    if (shortest < 1 || longest / shortest > 12) continue;

    // Below half a degree, a "rotation" is noise in the hull. Snapping avoids
    // resampling a photo that was already straight.
    const useAxisAligned = Math.abs(rect.angleDeg) < 0.5;
    const corners = useAxisAligned
      ? ([
          { x: Math.min(...rect.corners.map(p => p.x)), y: Math.min(...rect.corners.map(p => p.y)) },
          { x: Math.max(...rect.corners.map(p => p.x)), y: Math.min(...rect.corners.map(p => p.y)) },
          { x: Math.max(...rect.corners.map(p => p.x)), y: Math.max(...rect.corners.map(p => p.y)) },
          { x: Math.min(...rect.corners.map(p => p.x)), y: Math.max(...rect.corners.map(p => p.y)) }
        ] as [Point, Point, Point, Point])
      : rect.corners;

    const normalised = corners.map(p => ({
      x: Math.max(0, Math.min(1, p.x / w)),
      y: Math.max(0, Math.min(1, p.y / h))
    })) as [Point, Point, Point, Point];

    quads.push({
      id: `quad_${Date.now()}_${quads.length}`,
      points: normalised,
      confidence: Math.round(fill * 100) / 100,
      angleDeg: useAxisAligned ? 0 : Math.round(rect.angleDeg * 10) / 10,
      label: `Photo ${quads.length + 1}`
    });
  }

  // Suppress overlapping detections, largest first.
  //
  // A photo whose own content is close in colour to the page - a dark sea band
  // on a black album leaf, say - splits into pieces, and the leftover border
  // strip comes back as a second region sitting inside the real one. Keeping
  // the larger region and dropping anything mostly contained within it removes
  // those duplicates without needing the split to be prevented in the first
  // place.
  const bySize = [...quads].sort((a, b) => polygonArea(b.points) - polygonArea(a.points));
  const kept: PhotoQuad[] = [];
  for (const candidate of bySize) {
    const swallowed = kept.some(k => quadContainment(candidate.points, k.points) > 0.6);
    if (!swallowed) kept.push(candidate);
  }

  // Number them the way a person reads the page: top to bottom, left to right.
  kept.sort((a, b) => {
    const ay = Math.min(...a.points.map(p => p.y));
    const by = Math.min(...b.points.map(p => p.y));
    if (Math.abs(ay - by) > 0.05) return ay - by;
    return Math.min(...a.points.map(p => p.x)) - Math.min(...b.points.map(p => p.x));
  });
  kept.forEach((q, i) => { q.label = `Photo ${i + 1}`; });

  return kept;
}

/** A sheet decoded once, so every crop from it reuses the same pixel buffer. */
export interface SheetPixels {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/**
 * Decodes a sheet into a reusable pixel buffer.
 *
 * Extraction used to build a fresh full-resolution canvas copy of the sheet for
 * every single crop; eight photos on a 50 MP scan meant eight redundant copies.
 */
export function prepareSheet(image: DrawableSource): SheetPixels | null {
  const canvas = createCanvas(image.width, image.height);
  const ctx = get2d(canvas, { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(image as CanvasImageSource, 0, 0);
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { data: imgData.data, width: canvas.width, height: canvas.height };
}

/**
 * Crops and rectifies one quad out of a prepared sheet.
 *
 * Solves the true homography from the output rectangle back to the source quad,
 * then inverse-maps every destination pixel through it with bilinear sampling.
 * Straight lines stay straight and the interior is geometrically correct, which
 * a bilinear corner blend cannot guarantee for a perspective view.
 *
 * It is also far cheaper than the previous approach, which drew the entire
 * source image 512 times per photo (a 16x16 mesh of clipped triangle pairs) and
 * left faint seams along every clip edge where the antialiasing met transparent
 * pixels.
 */
export function extractAndDeskewPhoto(
  sheet: SheetPixels,
  quad: PhotoQuad,
  targetWidth?: number,
  targetHeight?: number
): AnyCanvas | null {
  const { data: src, width: srcW, height: srcH } = sheet;

  const ordered = orderQuadPoints(quad.points.map(p => ({ x: p.x * srcW, y: p.y * srcH })));
  const [p0, p1, p2, p3] = ordered;

  // Output size follows the longer of each opposing pair, so nothing is squashed.
  let outW = targetWidth || Math.round(Math.max(distance(p0, p1), distance(p3, p2)));
  let outH = targetHeight || Math.round(Math.max(distance(p0, p3), distance(p1, p2)));

  outW = Math.max(1, Math.min(MAX_OUTPUT_DIM, outW));
  outH = Math.max(1, Math.min(MAX_OUTPUT_DIM, outH));

  const dest = createCanvas(outW, outH);
  const destCtx = get2d(dest);
  if (!destCtx) return null;

  // Homography from destination rectangle -> source quad, i.e. the inverse map.
  const h = solveHomography(
    [{ x: 0, y: 0 }, { x: outW, y: 0 }, { x: outW, y: outH }, { x: 0, y: outH }],
    [p0, p1, p2, p3]
  );
  if (!h) return null;

  // When the source region is much larger than the output, point sampling
  // aliases badly. Average a small grid of samples per output pixel instead.
  const srcSpanX = Math.max(distance(p0, p1), distance(p3, p2));
  const srcSpanY = Math.max(distance(p0, p3), distance(p1, p2));
  const downscale = Math.max(srcSpanX / outW, srcSpanY / outH);
  const ss = downscale > 1.5 ? Math.min(3, Math.round(downscale)) : 1;
  const ssWeight = 1 / (ss * ss);

  const out = destCtx.createImageData(outW, outH);
  const dst = out.data;

  const sampleBilinear = (sx: number, sy: number, acc: Float32Array) => {
    if (sx < 0) sx = 0; else if (sx > srcW - 1) sx = srcW - 1;
    if (sy < 0) sy = 0; else if (sy > srcH - 1) sy = srcH - 1;

    const x0 = sx | 0;
    const y0 = sy | 0;
    const x1 = x0 + 1 < srcW ? x0 + 1 : x0;
    const y1 = y0 + 1 < srcH ? y0 + 1 : y0;
    const fx = sx - x0;
    const fy = sy - y0;

    const i00 = (y0 * srcW + x0) * 4;
    const i10 = (y0 * srcW + x1) * 4;
    const i01 = (y1 * srcW + x0) * 4;
    const i11 = (y1 * srcW + x1) * 4;

    const w00 = (1 - fx) * (1 - fy);
    const w10 = fx * (1 - fy);
    const w01 = (1 - fx) * fy;
    const w11 = fx * fy;

    for (let c = 0; c < 3; c++) {
      acc[c] += src[i00 + c] * w00 + src[i10 + c] * w10 + src[i01 + c] * w01 + src[i11 + c] * w11;
    }
  };

  const acc = new Float32Array(3);

  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      acc[0] = 0; acc[1] = 0; acc[2] = 0;

      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const dx = x + (sx + 0.5) / ss;
          const dy = y + (sy + 0.5) / ss;
          const s = applyHomography(h, { x: dx, y: dy });
          sampleBilinear(s.x, s.y, acc);
        }
      }

      const o = (y * outW + x) * 4;
      dst[o] = acc[0] * ssWeight;
      dst[o + 1] = acc[1] * ssWeight;
      dst[o + 2] = acc[2] * ssWeight;
      dst[o + 3] = 255;
    }
  }

  destCtx.putImageData(out, 0, 0);
  return dest;
}

/**
 * Encodes a crop to a Blob.
 *
 * Crops are passed around as Blobs rather than data URLs: base64 inflates the
 * payload by a third, and every conversion allocates the whole thing again as a
 * JavaScript string.
 */
export const canvasToBlob = encodeCanvas;

