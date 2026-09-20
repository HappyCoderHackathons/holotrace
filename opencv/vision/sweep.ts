// The parts of the sweep (see ../candidates.ts) and of merging (../reconcile.ts) that look at the ink.

import cv, { Mat } from "opencv-ts";
import { isSweepId } from "../candidates";
import { SWEEP_MIN_INK_FRACTION, SWEEP_TIGHT_PAD } from "../config";
import { type Corners, type Rect, toCorners, toRect } from "../geometry/boxes";
import { state } from "../state";

// The windows that hold enough ink to be worth sending: an empty patch of paper is not a component.
export function windowsWithInk(ink: Mat, windows: Rect[]): Rect[] {
    return windows.filter((window) => {
        const part = ink.roi(new cv.Rect(window.x, window.y, window.width, window.height));
        const fraction = cv.countNonZero(part) / (window.width * window.height);
        part.delete();
        return fraction >= SWEEP_MIN_INK_FRACTION;
    });
}

// The box shrunk to the ink inside it, plus `pad` pixels (a coarse sweep window is rarely tight on the
// component). The box itself if it holds no ink.
export function tightenToInk(ink: Mat, box: Rect, pad = 0): Rect {
    const part = ink.roi(new cv.Rect(box.x, box.y, box.width, box.height));
    if (cv.countNonZero(part) === 0) {
        part.delete();
        return box;
    }
    const inner = cv.boundingRect(part);
    part.delete();
    const x0 = Math.max(0, box.x + inner.x - pad);
    const y0 = Math.max(0, box.y + inner.y - pad);
    const x1 = Math.min(ink.cols, box.x + inner.x + inner.width + pad);
    const y1 = Math.min(ink.rows, box.y + inner.y + inner.height + pad);
    return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

// The regions with each sweep window shrunk to the ink inside it (the first pass's own boxes are left alone),
// ready for reconcile. Call it with the ink the windows were laid over.
export function tightenRegions<R extends { id: string; box: Corners }>(ink: Mat, regions: R[]): R[] {
    const pad = Math.round(SWEEP_TIGHT_PAD * state.detectScale);
    return regions.map((region) => (isSweepId(region.id) ? { ...region, box: toCorners(tightenToInk(ink, toRect(region.box), pad)) } : region));
}
