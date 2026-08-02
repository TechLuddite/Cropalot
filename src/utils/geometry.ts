import { Point } from '../types';

/** Euclidean distance between two points. */
export function distance(p1: Point, p2: Point): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Orders 4 points into Top-Left, Top-Right, Bottom-Right, Bottom-Left.
 *
 * Uses angle about the centroid rather than the common sum/difference trick.
 * The sum/difference heuristic silently returns the same point twice for
 * quads rotated past ~45 degrees, which is exactly the case this app has to
 * handle, and a degenerate quad renders as garbage with no warning.
 */
export function orderQuadPoints(points: Point[]): [Point, Point, Point, Point] {
  if (points.length !== 4) {
    throw new Error('Quad must have exactly 4 points');
  }

  const cx = (points[0].x + points[1].x + points[2].x + points[3].x) / 4;
  const cy = (points[0].y + points[1].y + points[2].y + points[3].y) / 4;

  // Sort counter-clockwise in screen space (y grows downward), starting from
  // the -Y axis so index 0 lands in the upper-left quadrant.
  const sorted = [...points].sort((a, b) => {
    const angleA = Math.atan2(a.y - cy, a.x - cx);
    const angleB = Math.atan2(b.y - cy, b.x - cx);
    return angleA - angleB;
  });

  // sorted[] now runs clockwise starting somewhere arbitrary. Rotate so the
  // point closest to the top-left corner of the bounding box comes first.
  let startIdx = 0;
  let best = Infinity;
  const minX = Math.min(...points.map(p => p.x));
  const minY = Math.min(...points.map(p => p.y));
  sorted.forEach((p, i) => {
    const d = (p.x - minX) ** 2 + (p.y - minY) ** 2;
    if (d < best) {
      best = d;
      startIdx = i;
    }
  });

  return [
    sorted[startIdx],
    sorted[(startIdx + 1) % 4],
    sorted[(startIdx + 2) % 4],
    sorted[(startIdx + 3) % 4]
  ];
}

/** Signed area of a polygon (shoelace). Positive for counter-clockwise. */
export function polygonArea(poly: Point[]): number {
  let area = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    area += (poly[j].x + poly[i].x) * (poly[j].y - poly[i].y);
  }
  return Math.abs(area / 2);
}

/**
 * Convex hull via Andrew's monotone chain. Returns hull points counter-clockwise.
 */
export function convexHull(points: Point[]): Point[] {
  if (points.length < 3) return [...points];

  const pts = [...points].sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));

  const cross = (o: Point, a: Point, b: Point) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

  const lower: Point[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper: Point[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }

  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

export interface OrientedRect {
  corners: [Point, Point, Point, Point];
  /** Rotation in degrees, in (-45, 45]. */
  angleDeg: number;
  area: number;
}

/**
 * Minimum-area enclosing rectangle of a convex hull, via rotating calipers.
 *
 * This is what actually produces a *rotated* quad. Every edge of the hull is
 * tested as a candidate rectangle side: rotate the hull so that edge lies on
 * the x-axis, take the axis-aligned bounding box, and keep whichever rotation
 * yields the smallest area. The optimal rectangle is always flush with a hull
 * edge, so checking all edges is exact rather than approximate.
 */
export function minAreaRect(hull: Point[]): OrientedRect | null {
  if (hull.length < 3) return null;

  let best: OrientedRect | null = null;

  for (let i = 0; i < hull.length; i++) {
    const p0 = hull[i];
    const p1 = hull[(i + 1) % hull.length];

    const edgeLen = distance(p0, p1);
    if (edgeLen < 1e-9) continue;

    // Unit vector along this edge, and its perpendicular.
    const ux = (p1.x - p0.x) / edgeLen;
    const uy = (p1.y - p0.y) / edgeLen;

    let minU = Infinity, maxU = -Infinity;
    let minV = Infinity, maxV = -Infinity;

    for (const p of hull) {
      const dx = p.x - p0.x;
      const dy = p.y - p0.y;
      const u = dx * ux + dy * uy;        // along the edge
      const v = -dx * uy + dy * ux;       // perpendicular to it
      if (u < minU) minU = u;
      if (u > maxU) maxU = u;
      if (v < minV) minV = v;
      if (v > maxV) maxV = v;
    }

    const area = (maxU - minU) * (maxV - minV);
    if (best && area >= best.area) continue;

    // Map the four (u,v) extremes back into image space.
    const toXY = (u: number, v: number): Point => ({
      x: p0.x + u * ux - v * uy,
      y: p0.y + u * uy + v * ux
    });

    const corners: [Point, Point, Point, Point] = [
      toXY(minU, minV),
      toXY(maxU, minV),
      toXY(maxU, maxV),
      toXY(minU, maxV)
    ];

    // Normalise the reported angle into (-45, 45]: a rectangle rotated 80
    // degrees is the same rectangle rotated -10 with its sides swapped.
    let angleDeg = (Math.atan2(uy, ux) * 180) / Math.PI;
    angleDeg = ((angleDeg % 90) + 135) % 90 - 45;

    best = { corners: orderQuadPoints(corners), angleDeg, area };
  }

  return best;
}

/**
 * Clips subject polygon against a convex clip polygon (Sutherland-Hodgman).
 * Both polygons must be convex and wound consistently.
 */
function clipPolygon(subject: Point[], clip: Point[]): Point[] {
  let output = [...subject];

  for (let i = 0; i < clip.length; i++) {
    if (output.length === 0) break;

    const a = clip[i];
    const b = clip[(i + 1) % clip.length];
    const input = output;
    output = [];

    // Positive side of the directed edge a->b.
    const side = (p: Point) => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);

    for (let j = 0; j < input.length; j++) {
      const cur = input[j];
      const prev = input[(j + input.length - 1) % input.length];
      const curIn = side(cur) >= 0;
      const prevIn = side(prev) >= 0;

      if (curIn !== prevIn) {
        const d1 = side(prev);
        const d2 = side(cur);
        const t = d1 / (d1 - d2);
        output.push({ x: prev.x + t * (cur.x - prev.x), y: prev.y + t * (cur.y - prev.y) });
      }
      if (curIn) output.push(cur);
    }
  }

  return output;
}

/** Orients a polygon counter-clockwise, as the clipper requires. */
function toCCW(poly: Point[]): Point[] {
  let sum = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    sum += (poly[i].x - poly[j].x) * (poly[i].y + poly[j].y);
  }
  return sum > 0 ? [...poly].reverse() : poly;
}

/** Area shared by two convex quads. */
export function quadIntersectionArea(a: Point[], b: Point[]): number {
  const inter = clipPolygon(toCCW(a), toCCW(b));
  return inter.length < 3 ? 0 : polygonArea(inter);
}

/**
 * Intersection-over-Union of two convex quads. Used to score automatic
 * detection against the known-correct corners of the built-in sample sheets.
 */
export function quadIoU(a: Point[], b: Point[]): number {
  const interArea = quadIntersectionArea(a, b);
  if (interArea === 0) return 0;
  const union = polygonArea(a) + polygonArea(b) - interArea;
  return union > 0 ? interArea / union : 0;
}

/** Fraction of `inner`'s own area that falls inside `outer`, 0-1. */
export function quadContainment(inner: Point[], outer: Point[]): number {
  const innerArea = polygonArea(inner);
  if (innerArea <= 0) return 0;
  return quadIntersectionArea(inner, outer) / innerArea;
}

/**
 * Solves the 3x3 homography H mapping src[i] -> dst[i] for four correspondences.
 *
 * Builds the standard 8x8 linear system and solves it by Gaussian elimination
 * with partial pivoting. Returns a row-major 9-element matrix with h22 fixed
 * at 1, or null if the correspondences are degenerate (three collinear points).
 *
 * This is the piece that makes perspective correction actually correct. A
 * bilinear blend of the four corners agrees with a homography only when the
 * quad is a parallelogram; for a page photographed at an angle the two differ
 * throughout the interior, and no amount of mesh subdivision closes the gap.
 */
export function solveHomography(src: Point[], dst: Point[]): number[] | null {
  if (src.length !== 4 || dst.length !== 4) return null;

  const A: number[][] = [];
  const rhs: number[] = [];

  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i];
    const { x: X, y: Y } = dst[i];
    A.push([x, y, 1, 0, 0, 0, -X * x, -X * y]);
    rhs.push(X);
    A.push([0, 0, 0, x, y, 1, -Y * x, -Y * y]);
    rhs.push(Y);
  }

  const n = 8;
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(A[r][col]) > Math.abs(A[pivot][col])) pivot = r;
    }
    if (Math.abs(A[pivot][col]) < 1e-12) return null;

    if (pivot !== col) {
      [A[col], A[pivot]] = [A[pivot], A[col]];
      [rhs[col], rhs[pivot]] = [rhs[pivot], rhs[col]];
    }

    const d = A[col][col];
    for (let c = col; c < n; c++) A[col][c] /= d;
    rhs[col] /= d;

    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = A[r][col];
      if (f === 0) continue;
      for (let c = col; c < n; c++) A[r][c] -= f * A[col][c];
      rhs[r] -= f * rhs[col];
    }
  }

  return [rhs[0], rhs[1], rhs[2], rhs[3], rhs[4], rhs[5], rhs[6], rhs[7], 1];
}

/** Applies a homography to a point, including the perspective divide. */
export function applyHomography(h: number[], p: Point): Point {
  const w = h[6] * p.x + h[7] * p.y + h[8];
  const safeW = Math.abs(w) < 1e-12 ? 1e-12 : w;
  return {
    x: (h[0] * p.x + h[1] * p.y + h[2]) / safeW,
    y: (h[3] * p.x + h[4] * p.y + h[5]) / safeW
  };
}
