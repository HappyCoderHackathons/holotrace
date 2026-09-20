// Deciding when to take the screenshot, and taking it.

import cv, { Mat } from "../../src/lib/vision/cv";
import { HOLD_DRAIN, STABLE_IOU } from "../../src/lib/vision/config";
import { cropToCircuit } from "../../src/lib/vision/circuit";
import { iou, type Rect } from "../../src/lib/vision/boxes";
import { state } from "../../src/lib/vision/state";

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

// Crops the full-resolution frame to the circuit (see cropToCircuit), shows it in the "Captured circuit" preview and
// returns the crop. `box` is in detection-frame pixels, `mask` is the circuit blob at that size. The caller owns the
// returned Mat.
export function captureCircuit(box: Rect, canvasId: string, mask: Mat): Mat {
    const still = cropToCircuit(state.fullFrame!, box, mask);
    cv.imshow(canvasId, still);
    const caption = document.getElementById(canvasId)!.previousElementSibling!;
    caption.textContent = `Captured circuit (${new Date().toLocaleTimeString()})`;
    return still;
}
