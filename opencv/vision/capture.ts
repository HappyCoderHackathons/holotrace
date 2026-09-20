// Taking the screenshot (deciding when is HoldMeter's job).

import cv, { Mat } from "../../src/lib/vision/cv";
import { cropToCircuit } from "../../src/lib/vision/circuit";
import type { Rect } from "../../src/lib/vision/boxes";
import { HoldMeter } from "../../src/lib/vision/hold";
import { state } from "../../src/lib/vision/state";

// The dev page's own hold meter (see HoldMeter in src/lib/vision/hold.ts), with the names the live stage uses.
export const hold = new HoldMeter();
export const resetHold = () => hold.reset();
export const trackCircuit = (box: Rect | null, now: number, holdMs: number) => hold.track(box, now, holdMs);

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
