// Finding the whole circuit in a photo or a camera frame, and cutting it out. Shared by the app (a chosen or captured
// photo) and the dev page (live frames), so both look at the same picture.

import cv, { type Mat } from "./cv";
import {
    BLOB_KERNEL,
    BLOB_KERNELS_STILL,
    CAPTURE_PADDING,
    CENTRE_PREFERENCE,
    EDGE_MARGIN,
    LIVE_INK_ATTEMPTS,
    MAX_CIRCUIT_FRACTION,
    MIN_CIRCUIT_FRACTION,
    MIN_HOLE_FRACTION,
} from "./config";
import type { Rect } from "./boxes";
import { detectScaleFor, state } from "./state";

export type FoundCircuit = {
    box: Rect;
    // Whether the blob encloses a hole. Only a closed circuit counts as complete.
    closed: boolean;
    // The filled blob (white inside). The caller must delete it.
    mask: Mat | null;
};

// The largest blob that is a plausible, fully visible circuit, or null. Prefers closed blobs.
export function findCircuit(blobs: Mat, frame: Mat): FoundCircuit | null {
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    // RETR_CCOMP also reports holes; hierarchy rows are [next, previous, first child, parent].
    cv.findContours(blobs, contours, hierarchy, cv.RETR_CCOMP, cv.CHAIN_APPROX_SIMPLE);
    const frameArea = frame.cols * frame.rows;
    let best: { box: Rect; closed: boolean } | null = null;
    let bestIndex = -1;
    let bestScore = 0;
    for (let n = 0; n < contours.size(); n++) {
        if (hierarchy.data32S[n * 4 + 3] !== -1) continue; // a hole, not a blob
        const contour = contours.get(n);
        const box = cv.boundingRect(contour);
        contour.delete();
        const area = box.width * box.height;
        const fullyInView =
            box.x >= EDGE_MARGIN &&
            box.y >= EDGE_MARGIN &&
            box.x + box.width <= frame.cols - EDGE_MARGIN &&
            box.y + box.height <= frame.rows - EDGE_MARGIN;
        const plausible = area >= MIN_CIRCUIT_FRACTION * frameArea && area <= MAX_CIRCUIT_FRACTION * frameArea;
        if (!fullyInView || !plausible) continue;

        let closed = false;
        for (let hole = hierarchy.data32S[n * 4 + 2]; hole !== -1; hole = hierarchy.data32S[hole * 4]) {
            const holeContour = contours.get(hole);
            const holeBox = cv.boundingRect(holeContour);
            holeContour.delete();
            if (holeBox.width * holeBox.height >= MIN_HOLE_FRACTION * area) closed = true;
        }
        // A bigger circuit is better, and one nearer the middle of the frame is better than one out at the edge.
        const reach = Math.hypot(frame.cols / 2, frame.rows / 2);
        const off = Math.hypot(box.x + box.width / 2 - frame.cols / 2, box.y + box.height / 2 - frame.rows / 2) / reach;
        const score = area * (1 - CENTRE_PREFERENCE * off);
        const better = best === null || (closed && !best.closed) || (closed === best.closed && score > bestScore);
        if (better) {
            bestScore = score;
            best = { box, closed };
            bestIndex = n;
        }
    }
    let mask: Mat | null = null;
    if (best !== null) {
        mask = new cv.Mat(frame.rows, frame.cols, cv.CV_8UC1, new cv.Scalar(0));
        (cv.drawContours as (...args: unknown[]) => void)(mask, contours, bestIndex, new cv.Scalar(255), cv.FILLED, cv.LINE_8, hierarchy, 0);
    }
    contours.delete();
    hierarchy.delete();
    return best === null ? null : { ...best, mask };
}

// Dark ink on light paper becomes white, and a dilation merges the whole drawing into one blob.
// Thresholds are tried in turn until one gives a circuit. `gray` is the (blurred) detection-size frame.
// `gaps` are the dilation sizes to try in order (the first to give a closed circuit wins; otherwise the last result stands).
export function findCircuitInGray(gray: Mat, frame: Mat, gaps: number[] = [BLOB_KERNEL]): FoundCircuit | null {
    const ink = new cv.Mat();
    const blobs = new cv.Mat();
    let found: FoundCircuit | null = null;
    for (const [blockSize, offset] of LIVE_INK_ATTEMPTS) {
        cv.adaptiveThreshold(gray, ink, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, blockSize, offset);
        for (const gap of gaps) {
            const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(gap, gap), new cv.Point(-1, -1));
            cv.dilate(ink, blobs, kernel);
            kernel.delete();
            // A wider gap that finds nothing (it merged into the page) does not lose what a tighter one found.
            const next = findCircuit(blobs, frame);
            if (next !== null) {
                found?.mask?.delete();
                found = next;
            }
            if (found?.closed) break;
        }
        if (found !== null) break;
    }
    blobs.delete();
    ink.delete();
    return found;
}

// Crops the full-resolution frame to the circuit. `box` is in detection-frame pixels and `mask` is the circuit blob at
// that size; the mask is kept (cut to the same crop) in state.capturedMask, so ink outside the circuit's own blob can be
// dropped later. The caller owns the returned Mat.
export function cropToCircuit(full: Mat, box: Rect, mask: Mat): Mat {
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

    const still = crop.clone();
    crop.delete();
    return still;
}

// Finds the circuit in a still photo (full resolution, RGBA) and cuts it out, or null when no whole circuit is in
// view (the caller then uses the photo as it is). Sets state.detectScale from the photo's width, as the live stage
// does, and state.capturedMask to the circuit's blob. The caller owns the returned Mat.
export function locateCircuit(full: Mat): Mat | null {
    state.detectScale = detectScaleFor(full.cols);
    const small = new cv.Mat();
    cv.resize(full, small, new cv.Size(Math.round(full.cols / state.detectScale), Math.round(full.rows / state.detectScale)), 0, 0, cv.INTER_AREA);
    const gray = new cv.Mat();
    const blurred = new cv.Mat();
    cv.cvtColor(small, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);
    const found = findCircuitInGray(blurred, small, BLOB_KERNELS_STILL);
    let crop: Mat | null = null;
    try {
        if (found !== null && found.mask !== null) crop = cropToCircuit(full, found.box, found.mask);
        else {
            // No circuit: the whole photo is scanned, so no mask from an earlier capture may linger.
            state.capturedMask?.delete();
            state.capturedMask = null;
        }
    } finally {
        found?.mask?.delete();
        blurred.delete();
        gray.delete();
        small.delete();
    }
    return crop;
}
