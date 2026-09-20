// The live stage: camera frames in, and a screenshot of the circuit out once it holds still.

import cv, { Mat } from "opencv-ts";
import { BLOB_KERNEL, CAPTURE_CANVAS_ID, HOLD_MS, HOLD_OPEN_MS, LIVE_INK_ATTEMPTS } from "../config";
import { state } from "../state";
import { captureCircuit, hold, trackCircuit } from "../vision/capture";
import { findCircuit, type FoundCircuit } from "../vision/circuit";
import type { Step } from "./preview";

// Dark ink on light paper becomes white, and a dilation merges the whole drawing into one blob.
// Thresholds are tried in turn until one gives a circuit.
function findLiveCircuit(gray: Mat, frame: Mat): FoundCircuit | null {
    const ink = new cv.Mat();
    const blobs = new cv.Mat();
    const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(BLOB_KERNEL, BLOB_KERNEL), new cv.Point(-1, -1));
    let found: FoundCircuit | null = null;
    for (const [blockSize, offset] of LIVE_INK_ATTEMPTS) {
        cv.adaptiveThreshold(gray, ink, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, blockSize, offset);
        cv.dilate(ink, blobs, kernel);
        found = findCircuit(blobs, frame);
        if (found !== null) break;
    }
    kernel.delete();
    blobs.delete();
    ink.delete();
    return found;
}

export const liveSteps: Step[] = [
    { name: "Original", apply: (i, o) => i.copyTo(o) },
    { name: "Grayscale", hidden: true, apply: (i, o) => cv.cvtColor(i, o, cv.COLOR_RGBA2GRAY) },
    { name: "Gaussian blur", hidden: true, apply: (i, o) => cv.GaussianBlur(i, o, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT) },
    // Boxes the circuit, and takes the screenshot once it has held still.
    {
        name: "Circuit detected",
        apply: (i, o, frame) => {
            frame.copyTo(o);
            const found = findLiveCircuit(i, frame);
            // A closed loop is taken after HOLD_MS, any other circuit after the longer HOLD_OPEN_MS.
            const fire = trackCircuit(found?.box ?? null, performance.now(), found?.closed ? HOLD_MS : HOLD_OPEN_MS);
            if (found === null) return;

            // grey: open circuit, waiting; yellow: closed circuit, waiting; green: captured
            const color = hold.captured
                ? new cv.Scalar(0, 255, 0, 255)
                : found.closed
                  ? new cv.Scalar(255, 200, 0, 255)
                  : new cv.Scalar(150, 150, 150, 255);
            const { x, y, width, height } = found.box;
            cv.rectangle(o, new cv.Point(x, y), new cv.Point(x + width, y + height), color, 2);
            if (fire && found.mask !== null) state.capturedImage = captureCircuit(found.box, CAPTURE_CANVAS_ID, found.mask);
            found.mask?.delete();
        },
    },
];
