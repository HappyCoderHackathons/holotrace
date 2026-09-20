// More candidate regions than the first pass finds. Pure geometry, no OpenCV, so a script can use it too.
//
// The first pass is a helper and never perfect: it misses components and boxes some that are not. A sweep
// lays square windows over the whole image and lets the classifier judge them, which puts the recall in the
// model's hands. The windows are cheap to send (about a thousand for a photo, a few seconds of CPU).

import { SWEEP_SIZE_FRACTIONS, SWEEP_STRIDE } from "./config";
import type { Rect } from "./geometry/boxes";

// The ids of sweep windows in a request; the first pass's own boxes are "region-N".
export const SWEEP_ID_PREFIX = "sweep-";

export const isSweepId = (id: string): boolean => id.startsWith(SWEEP_ID_PREFIX);

// Square windows of several sizes laid over an image of the given size, each overlapping the next.
export function gridWindows(width: number, height: number): Rect[] {
    const longSide = Math.max(width, height);
    const windows: Rect[] = [];
    for (const fraction of SWEEP_SIZE_FRACTIONS) {
        const size = Math.round(fraction * longSide);
        const stride = Math.max(1, Math.round(size * SWEEP_STRIDE));
        for (let y = 0; y + size <= height; y += stride) {
            for (let x = 0; x + size <= width; x += stride) windows.push({ x, y, width: size, height: size });
        }
    }
    return windows;
}

// At most `max` of the items, spread evenly through the list (so cutting a long list of windows does not
// lose every window of the largest size).
export function evenlyThinned<T>(items: T[], max: number): T[] {
    if (items.length <= max) return items;
    if (max <= 0) return [];
    const step = items.length / max;
    return Array.from({ length: max }, (_, n) => items[Math.floor(n * step)]);
}
