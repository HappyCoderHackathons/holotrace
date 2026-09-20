// The live stage: camera frames in, and a screenshot of the circuit out once it holds still.

import cv from "../../src/lib/vision/cv";
import { BLOB_KERNELS_STILL, CAPTURE_CANVAS_ID, HOLD_MS, HOLD_OPEN_MS } from "../../src/lib/vision/config";
import { state } from "../../src/lib/vision/state";
import { captureCircuit, hold, trackCircuit } from "../vision/capture";
import { findCircuitInGray } from "../../src/lib/vision/circuit";
import type { Step } from "./preview";

export const liveSteps: Step[] = [
    { name: "Original", apply: (i, o) => i.copyTo(o) },
    { name: "Grayscale", hidden: true, apply: (i, o) => cv.cvtColor(i, o, cv.COLOR_RGBA2GRAY) },
    { name: "Gaussian blur", hidden: true, apply: (i, o) => cv.GaussianBlur(i, o, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT) },
    // Boxes the circuit, and takes the screenshot once it has held still.
    {
        name: "Circuit detected",
        apply: (i, o, frame) => {
            frame.copyTo(o);
            const found = findCircuitInGray(i, frame, BLOB_KERNELS_STILL);
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
