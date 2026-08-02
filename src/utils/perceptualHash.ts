import { createCanvas, get2d, decodeBlob, release } from './canvasCompat';

/**
 * Difference hash (dHash) for spotting duplicate photos.
 *
 * Anyone digitising a shoebox rescans pages - a page gets photographed twice,
 * a batch gets dropped in again, the same print appears in two albums. A
 * cryptographic hash is useless for that because re-scanning never produces
 * identical bytes; a perceptual hash compares what the picture *looks* like.
 *
 * dHash reduces the image to 9x8 greyscale and records, for each row, whether
 * each pixel is brighter than the one to its right. That is 64 bits describing
 * the gradient structure, which survives rescanning, resizing and modest
 * exposure differences, while genuinely different photographs disagree in
 * roughly half their bits.
 *
 * Structure alone is not enough for photographs, though. Two pictures of the
 * same scene - the same group on the same porch, one roll apart - share a
 * gradient layout while being entirely different photographs, and greyscale
 * discards the colour that separates them. So a coarse colour signature is
 * appended, and two photos count as the same only when both the structure and
 * the colours agree.
 */

const HASH_W = 9;
const HASH_H = 8;

/**
 * `<16 hex chars of dHash>:<24 hex chars of 2x2 mean RGB>`.
 * Stored as one string so a photo record carries a single opaque field.
 */
export async function perceptualHash(image: Blob): Promise<string> {
  const decoded = await decodeBlob(image);
  try {
    const canvas = createCanvas(HASH_W, HASH_H);
    const ctx = get2d(canvas, { willReadFrequently: true });
    if (!ctx) return '';

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(decoded as CanvasImageSource, 0, 0, HASH_W, HASH_H);

    const { data } = ctx.getImageData(0, 0, HASH_W, HASH_H);
    const grey = new Float32Array(HASH_W * HASH_H);
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      grey[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }

    // One bit per adjacent horizontal pair: 8 rows x 8 comparisons = 64 bits.
    let hex = '';
    let nibble = 0;
    let bitsInNibble = 0;

    for (let y = 0; y < HASH_H; y++) {
      for (let x = 0; x < HASH_W - 1; x++) {
        const bit = grey[y * HASH_W + x] > grey[y * HASH_W + x + 1] ? 1 : 0;
        nibble = (nibble << 1) | bit;
        if (++bitsInNibble === 4) {
          hex += nibble.toString(16);
          nibble = 0;
          bitsInNibble = 0;
        }
      }
    }

    return `${hex}:${colourSignature(data)}`;
  } finally {
    release(decoded);
  }
}

/**
 * Mean RGB of each quadrant, as 12 hex bytes.
 *
 * Deliberately coarse: it has to survive a rescan under different lighting
 * while still separating a sunset from a lawn.
 */
function colourSignature(data: Uint8ClampedArray): string {
  const sums = [0, 1, 2, 3].map(() => ({ r: 0, g: 0, b: 0, n: 0 }));

  for (let y = 0; y < HASH_H; y++) {
    for (let x = 0; x < HASH_W; x++) {
      const q = (y < HASH_H / 2 ? 0 : 2) + (x < HASH_W / 2 ? 0 : 1);
      const i = (y * HASH_W + x) * 4;
      sums[q].r += data[i];
      sums[q].g += data[i + 1];
      sums[q].b += data[i + 2];
      sums[q].n++;
    }
  }

  return sums
    .map(s => {
      const hex = (v: number) => Math.round(v / Math.max(1, s.n)).toString(16).padStart(2, '0');
      return hex(s.r) + hex(s.g) + hex(s.b);
    })
    .join('');
}

const POPCOUNT = new Uint8Array(16);
for (let i = 0; i < 16; i++) POPCOUNT[i] = (i & 1) + ((i >> 1) & 1) + ((i >> 2) & 1) + ((i >> 3) & 1);

/** Number of differing bits between two dHash strings; 64 means nothing in common. */
export function hammingDistance(a: string, b: string): number {
  const structureA = a?.split(':')[0] ?? '';
  const structureB = b?.split(':')[0] ?? '';
  if (!structureA || structureA.length !== structureB.length) return 64;

  let distance = 0;
  for (let i = 0; i < structureA.length; i++) {
    distance += POPCOUNT[(parseInt(structureA[i], 16) ^ parseInt(structureB[i], 16)) & 0xf];
  }
  return distance;
}

/** Largest per-channel difference between two colour signatures, 0-255. */
export function colourDistance(a: string, b: string): number {
  const ca = a?.split(':')[1];
  const cb = b?.split(':')[1];
  if (!ca || !cb || ca.length !== cb.length) return 255;

  let worst = 0;
  for (let i = 0; i < ca.length; i += 2) {
    const diff = Math.abs(parseInt(ca.slice(i, i + 2), 16) - parseInt(cb.slice(i, i + 2), 16));
    if (diff > worst) worst = diff;
  }
  return worst;
}

/**
 * At or below this many differing bits, two photos have the same structure.
 * Ten of sixty-four tolerates rescanning and exposure drift while staying well
 * clear of the ~32 that unrelated images average.
 */
export const DUPLICATE_THRESHOLD = 10;

/**
 * How far the quadrant colours may drift and still count as the same photo.
 * Generous enough for a rescan on a different scanner, tight enough that the
 * same composition in different colours stays two photographs.
 */
export const COLOUR_THRESHOLD = 28;

/** Whether two photos should be treated as the same picture. */
export function looksLikeSamePhoto(a: string, b: string, threshold = DUPLICATE_THRESHOLD): boolean {
  return hammingDistance(a, b) <= threshold && colourDistance(a, b) <= COLOUR_THRESHOLD;
}

export interface DuplicateGroup {
  ids: string[];
}

/**
 * Groups photos that look like the same picture, transitively: if A matches B
 * and B matches C, all three land in one group even when A and C differ a
 * little more than the threshold.
 */
export function findDuplicateGroups(
  photos: { id: string; hash?: string }[],
  threshold = DUPLICATE_THRESHOLD
): DuplicateGroup[] {
  const hashed = photos.filter(p => p.hash);
  const parent = new Map<string, string>();

  const find = (id: string): string => {
    let root = id;
    while (parent.get(root) !== root) root = parent.get(root) ?? root;
    // Path compression keeps repeated lookups cheap on large libraries.
    let cur = id;
    while (parent.get(cur) !== root) {
      const next = parent.get(cur) ?? root;
      parent.set(cur, root);
      cur = next;
    }
    return root;
  };

  for (const p of hashed) parent.set(p.id, p.id);

  for (let i = 0; i < hashed.length; i++) {
    for (let j = i + 1; j < hashed.length; j++) {
      if (looksLikeSamePhoto(hashed[i].hash!, hashed[j].hash!, threshold)) {
        const a = find(hashed[i].id);
        const b = find(hashed[j].id);
        if (a !== b) parent.set(a, b);
      }
    }
  }

  const groups = new Map<string, string[]>();
  for (const p of hashed) {
    const root = find(p.id);
    const list = groups.get(root);
    if (list) list.push(p.id);
    else groups.set(root, [p.id]);
  }

  return [...groups.values()].filter(ids => ids.length > 1).map(ids => ({ ids }));
}
