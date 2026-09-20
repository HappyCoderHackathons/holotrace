// Deciding when to take the screenshot, and taking it.

import cv, { Mat } from "opencv-ts";
import { CAPTURE_PADDING, HOLD_DRAIN, STABLE_IOU } from "../config";
import { iou, type Rect } from "../geometry/boxes";
import { state } from "../state";

// Watches the circuit box over time like a charge meter. Every frame the circuit is seen holding
// still it charges, and every frame it is missing or has moved it drains (at HOLD_DRAIN times the
// charging speed) instead of starting over. The screenshot is taken when the charge is full.
export const hold: { box: Rect | null; charge: number; last: number; captured: boolean } = {
    box: null,
    charge: 0,
    last: 0,
    captured: false,
};

export function resetHold() {
    hold.box = null;
    hold.charge = 0;
    hold.captured = false;
}

// Feeds one frame's circuit box (or null if there is none). Returns true on the frame the
// screenshot should be taken, once `holdMs` of holding still has been charged.
export function trackCircuit(box: Rect | null, now: number, holdMs: number): boolean {
    const dt = hold.last === 0 ? 0 : now - hold.last;
    hold.last = now;
    const steady = box !== null && hold.box !== null && iou(hold.box, box) >= STABLE_IOU;
    hold.charge = steady ? hold.charge + dt : Math.max(0, hold.charge - dt * HOLD_DRAIN);
    if (box !== null) hold.box = box;
    if (hold.charge === 0 && box === null) resetHold();
    const fire = !hold.captured && hold.charge >= holdMs;
    if (fire) hold.captured = true;
    return fire;
}

// Crops the full-resolution frame to the circuit, shows it in the "Captured circuit" preview and
// returns the crop. `box` is in detection-frame pixels, `mask` is the circuit blob at that size;
// the mask is kept (cut to the same crop) in state.capturedMask. The caller owns the returned Mat.
export function captureCircuit(box: Rect, canvasId: string, mask: Mat): Mat {
    const full = state.fullFrame!;
    const scale = state.detectScale;
    const x = Math.max(0, Math.round((box.x - CAPTURE_PADDING) * scale));
    const y = Math.max(0, Math.round((box.y - CAPTURE_PADDING) * scale));
    const right = Math.min(full.cols, Math.round((box.x + box.width + CAPTURE_PADDING) * scale));
    const bottom = Math.min(full.rows, Math.round((box.y + box.height + CAPTURE_PADDING) * scale));
    const rect = new cv.Rect(x, y, right - x, bottom - y);
    const crop = full.roi(rect);

    const maskFull = new cv.Mat();
    cv.resize(mask, maskFull, new cv.Size(full.cols, full.rows), 0, 0, cv.INTER_NEAREST);
    const maskCrop = maskFull.roi(rect);
    state.capturedMask?.delete();
    state.capturedMask = maskCrop.clone();
    maskCrop.delete();
    maskFull.delete();

    cv.imshow(canvasId, crop);
    const still = crop.clone();
    crop.delete();
    const caption = document.getElementById(canvasId)!.previousElementSibling!;
    caption.textContent = `Captured circuit (${new Date().toLocaleTimeString()})`;
    return still;
}
