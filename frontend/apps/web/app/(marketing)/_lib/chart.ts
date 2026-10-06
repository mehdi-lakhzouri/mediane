/** Geometry helpers for the hand-drawn SVG charts. */

export type Point = { x: number; y: number };

/** The point at `index`, clamped to the ends of a non-empty series. */
export function pointAt(points: readonly Point[], index: number): Point {
  const point = points[Math.min(Math.max(index, 0), points.length - 1)];
  if (!point) throw new Error("pointAt needs at least one point");
  return point;
}

/** The latest point of a non-empty series. */
export function lastPoint(points: readonly Point[]): Point {
  return pointAt(points, points.length - 1);
}

/** Maps values to points inside a `width` x `height` box (y grows down). */
export function toPoints(
  values: readonly number[],
  width: number,
  height: number,
  { min, max, padY = 4 }: { min?: number; max?: number; padY?: number } = {},
): Point[] {
  const lo = min ?? Math.min(...values);
  const hi = max ?? Math.max(...values);
  const span = hi - lo || 1;
  const step = values.length > 1 ? width / (values.length - 1) : 0;
  return values.map((value, index) => ({
    x: index * step,
    y: padY + (1 - (value - lo) / span) * (height - padY * 2),
  }));
}

/** Smooth curve through every point (Catmull-Rom converted to Béziers). */
export function smoothPath(points: readonly Point[], tension = 0.5): string {
  if (points.length === 0) return "";
  const first = pointAt(points, 0);
  let path = `M${first.x.toFixed(2)},${first.y.toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = pointAt(points, i - 1);
    const p1 = pointAt(points, i);
    const p2 = pointAt(points, i + 1);
    const p3 = pointAt(points, i + 2);
    const c1x = p1.x + ((p2.x - p0.x) / 6) * tension * 2;
    const c1y = p1.y + ((p2.y - p0.y) / 6) * tension * 2;
    const c2x = p2.x - ((p3.x - p1.x) / 6) * tension * 2;
    const c2y = p2.y - ((p3.y - p1.y) / 6) * tension * 2;
    path += ` C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
  }
  return path;
}

/** Straight segments, for jagged series like alert counts. */
export function linePath(points: readonly Point[]): string {
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(" ");
}

/** Closes a line down to the baseline so it can be filled. */
export function areaPath(line: string, points: readonly Point[], baseline: number): string {
  if (points.length === 0) return "";
  const last = lastPoint(points);
  const first = pointAt(points, 0);
  return `${line} L${last.x.toFixed(2)},${baseline} L${first.x.toFixed(2)},${baseline} Z`;
}
