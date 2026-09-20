// Finding the whole circuit in a live camera frame.

import cv, { Mat } from "opencv-ts";
import { EDGE_MARGIN, MAX_CIRCUIT_FRACTION, MIN_CIRCUIT_FRACTION, MIN_HOLE_FRACTION } from "../config";
import type { Rect } from "../geometry/boxes";

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
        const better =
            best === null || (closed && !best.closed) || (closed === best.closed && area > best.box.width * best.box.height);
        if (better) {
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
