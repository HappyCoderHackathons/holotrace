// Finding the ink on a captured still image.

import cv, { Mat } from "opencv-ts";
import { INK_BLOCK_SIZE, INK_ELBOW, INK_OFFSET_MAX, INK_OFFSET_MIN, INK_OFFSET_STEP } from "../config";
import { state } from "../state";

// Rounds up to the nearest odd whole number, as OpenCV kernels and block sizes require.
export function odd(n: number): number {
    return Math.max(3, Math.round(n) | 1);
}

// The threshold offset for a blurred grey still. A low offset also picks up ruled lines and paper
// grain, and a high one loses thin or faint pen strokes. The ink shrinks fast with the offset while
// it is still picking up that clutter, then slowly, so this takes the first offset after which the
// shrinkage stays below INK_ELBOW of the whole range's, and one step more for safety.
function chooseOffset(blurred: Mat, blockSize: number): number {
    const ink = new cv.Mat();
    const counts: number[] = [];
    const offsets: number[] = [];
    for (let offset = INK_OFFSET_MIN; offset <= INK_OFFSET_MAX; offset += INK_OFFSET_STEP) {
        cv.adaptiveThreshold(blurred, ink, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, blockSize, offset);
        counts.push(cv.countNonZero(ink));
        offsets.push(offset);
    }
    ink.delete();
    const total = Math.max(1, counts[0] - counts[counts.length - 1]);
    for (let n = 0; n < counts.length - 1; n++) {
        if ((counts[n] - counts[n + 1]) / total <= INK_ELBOW) return offsets[Math.min(n + 1, offsets.length - 1)];
    }
    return offsets[offsets.length - 1];
}

// White where there is ink, on a still image. Sizes are scaled up from the detection frame, and ink
// outside the captured circuit's own blob is dropped.
export function inkMask(still: Mat): Mat {
    const gray = new cv.Mat();
    const blurred = new cv.Mat();
    const ink = new cv.Mat();
    const scale = state.detectScale;
    const blockSize = odd(INK_BLOCK_SIZE * scale);
    cv.cvtColor(still, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, blurred, new cv.Size(odd(5 * scale), odd(5 * scale)), 0, 0, cv.BORDER_DEFAULT);
    cv.adaptiveThreshold(blurred, ink, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, blockSize, chooseOffset(blurred, blockSize));
    gray.delete();
    blurred.delete();
    if (state.capturedMask !== null) cv.bitwise_and(ink, state.capturedMask, ink);
    return ink;
}
