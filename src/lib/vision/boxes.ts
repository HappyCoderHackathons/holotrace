// Rectangles and boxes given by their corners, and how they relate. Pure geometry, no OpenCV.

export type Rect = { x: number; y: number; width: number; height: number };

export const area = (r: Rect): number => r.width * r.height;
export const longSide = (r: Rect): number => Math.max(r.width, r.height);
// Short side over long side: 1 for a square, near 0 for a long thin box.
export const aspect = (r: Rect): number => Math.min(r.width, r.height) / longSide(r);

// Whether two rectangles overlap, or lie within `gap` of each other.
export const near = (a: Rect, b: Rect, gap: number): boolean =>
    Math.min(a.x + a.width + gap, b.x + b.width) > Math.max(a.x - gap, b.x) &&
    Math.min(a.y + a.height + gap, b.y + b.height) > Math.max(a.y - gap, b.y);

// How much two rectangles overlap, from 0 (apart) to 1 (identical): intersection over union.
export function iou(a: Rect, b: Rect): number {
    const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
    const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
    const inter = w > 0 && h > 0 ? w * h : 0;
    return inter / (a.width * a.height + b.width * b.height - inter);
}

// A box given by its corners, as in the recognition JSON; x1 and y1 are exclusive.
export type Corners = { x0: number; y0: number; x1: number; y1: number };

export const toRect = (box: Corners): Rect => ({ x: box.x0, y: box.y0, width: box.x1 - box.x0, height: box.y1 - box.y0 });
export const toCorners = (rect: Rect): Corners => ({ x0: rect.x, y0: rect.y, x1: rect.x + rect.width, y1: rect.y + rect.height });

// Whether the centre of `inner` lies inside `outer`.
export function centreInside(inner: Corners, outer: Corners): boolean {
    const x = (inner.x0 + inner.x1) / 2;
    const y = (inner.y0 + inner.y1) / 2;
    return x >= outer.x0 && x < outer.x1 && y >= outer.y0 && y < outer.y1;
}

export const iouCorners = (a: Corners, b: Corners): number => iou(toRect(a), toRect(b));
export const longSideCorners = (box: Corners): number => longSide(toRect(box));
