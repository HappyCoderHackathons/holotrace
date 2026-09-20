// The still stage: works on the captured circuit after the camera and circuit detection stop.

import cv, { Mat } from "../../src/lib/vision/cv";
import { COMPONENT_COLOR, COMPONENT_CROP_MARGIN_STROKES, SHARPEN_AMOUNT, SHARPEN_SIGMA } from "../../src/lib/vision/config";
import { buildRecognition } from "../../src/lib/vision/recognition";
import { state } from "../../src/lib/vision/state";
import { classify, nameOf } from "../../src/lib/vision/classify";
import { findComponents } from "../../src/lib/vision/components";
import { inkMask } from "../../src/lib/vision/ink";
import { showRecognition } from "./recognition-panel";
import { makePreview, type Step } from "./preview";

// Line thickness for drawings on the still, in still pixels.
const strokeWidth = () => Math.max(2, Math.round(state.detectScale));

// Whether component n was matched to a symbol well enough to be named.
const nameOfComponent = (n: number) => nameOf(state.analysis!.matches[n]);

const sharpen: Step = {
    name: "Sharpened",
    apply: (i, o) => {
        const blurred = new cv.Mat();
        cv.GaussianBlur(i, blurred, new cv.Size(0, 0), SHARPEN_SIGMA, SHARPEN_SIGMA, cv.BORDER_DEFAULT);
        cv.addWeighted(i, SHARPEN_AMOUNT, blurred, 1 - SHARPEN_AMOUNT, 0, o, -1);
        blurred.delete();
    },
};

// The components (lamp, battery, switch...), boxed and numbered on the capture, with the name of
// each one that was recognised.
const components: Step = {
    name: "Components",
    apply: (_i, o, still) => {
        still.copyTo(o);
        const thickness = strokeWidth();
        state.analysis!.components.forEach((box, n) => {
            cv.rectangle(o, new cv.Point(box.x, box.y), new cv.Point(box.x + box.width, box.y + box.height), new cv.Scalar(...COMPONENT_COLOR), thickness);
            (cv.putText as (...args: unknown[]) => void)(
                o,
                nameOfComponent(n) !== null ? `${n + 1} ${nameOfComponent(n)}` : String(n + 1),
                new cv.Point(box.x + thickness * 2, box.y + thickness * 8),
                cv.FONT_HERSHEY_SIMPLEX,
                0.4 * state.detectScale,
                new cv.Scalar(...COMPONENT_COLOR),
                thickness,
            );
        });
    },
};

const stillSteps: Step[] = [sharpen, components];

// Previews made for the current still; replaced when the next capture is processed.
let stillPreviewIds: string[] = [];

// Runs every still step on the captured image and shows each result, then shows each
// component cut out on its own.
export function processStill(still: Mat) {
    stillPreviewIds.forEach((id) => document.getElementById(id)?.parentElement?.remove());
    stillPreviewIds = [];

    const ink = inkMask(still);
    const { boxes, thickness } = findComponents(ink);
    state.analysis = { components: boxes, matches: boxes.map((box) => classify(ink, box, thickness)), thickness };
    try {
        let previous = still;
        let sharpened = still;
        for (const step of stillSteps) {
            const output = new cv.Mat();
            step.apply(previous, output, still);
            const id = makePreview(step.name);
            stillPreviewIds.push(id);
            cv.imshow(id, output);
            if (step === sharpen) sharpened = output;
            previous = output;
        }
        // What the next stage receives: the sharpened circuit, and the JSON that describes it.
        showRecognition(buildRecognition(sharpened.cols, sharpened.rows, state.analysis.components, state.analysis.matches), sharpened);
        // Each component on its own, with more room around it than its box, and what it was taken for.
        const margin = Math.round(COMPONENT_CROP_MARGIN_STROKES * state.analysis.thickness);
        state.analysis.components.forEach((box, n) => {
            const x0 = Math.max(0, box.x - margin);
            const y0 = Math.max(0, box.y - margin);
            const x1 = Math.min(still.cols, box.x + box.width + margin);
            const y1 = Math.min(still.rows, box.y + box.height + margin);
            const crop = still.roi(new cv.Rect(x0, y0, x1 - x0, y1 - y0));
            const id = makePreview(`Component ${n + 1}`);
            stillPreviewIds.push(id);
            cv.imshow(id, crop);
            crop.delete();
            const { label, confidence } = state.analysis!.matches[n];
            const name = nameOfComponent(n);
            document.getElementById(id)!.previousElementSibling!.textContent =
                `Component ${n + 1}: ${name !== null ? `${name} ${confidence.toFixed(2)}` : `no good guess (closest ${label} ${confidence.toFixed(2)})`}`;
        });
    } finally {
        ink.delete();
        state.analysis = null;
    }
}
