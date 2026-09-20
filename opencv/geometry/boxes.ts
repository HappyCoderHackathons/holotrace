// Rectangles, and how much two of them overlap. Pure geometry, no OpenCV.

export type Rect = { x: number; y: number; width: number; height: number };

// How much two rectangles overlap, from 0 (apart) to 1 (identical): intersection over union.
export function iou(a: Rect, b: Rect): number {
    const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
    const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
    const inter = w > 0 && h > 0 ? w * h : 0;
    return inter / (a.width * a.height + b.width * b.height - inter);
}
