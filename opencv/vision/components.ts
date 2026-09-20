// Finding the components (lamp, battery, resistor, gate, switch...) in the ink of a captured circuit.
//
// A component is one of two things, everything sized in pen-stroke widths so it suits any pen:
//  - A closed body: the enclosed area of a gate, a lamp or a switch loop. Sketched outlines have small
//    gaps where wires join, so the ink is closed a little before enclosed areas are looked for.
//  - A solid scribble: a battery or resistor drawn as a filled block.
// Wires, junction dots and text are neither, so they get no box.

import cv, { type Mat } from "opencv-ts";
import {
    BODY_CLOSE_STROKES,
    BODY_MAX_STROKES,
    BODY_MIN_ASPECT,
    BODY_MIN_SOLIDITY,
    BODY_MIN_STROKES,
    COMPONENT_MAX_AREA_FRACTION,
    COMPONENT_PAD_STROKES,
    EDGE_STROKES,
    MERGE_GAP_STROKES,
    RING_CLOSE_STROKES,
    RING_MIN_STROKES,
    RING_PIECE_STROKES,
    RING_REACH_STROKES,
    RING_SMALL_STROKES,
    SCRAP_RATIO,
    SOLID_CLOSE_STROKES,
    SOLID_MIN_ASPECT,
    SOLID_MIN_FILL,
    SOLID_MIN_STROKES,
    SOLID_OPEN_STROKES,
} from "../config";
import { area, aspect, longSide, near, type Rect } from "../geometry/boxes";
import { odd } from "./ink";

// How thick one stroke is, in pixels: the ink's area over the length of its centre line.
function strokeThickness(ink: Mat): number {
    const skel = new cv.Mat(ink.rows, ink.cols, cv.CV_8UC1, new cv.Scalar(0));
    const kernel = cv.getStructuringElement(cv.MORPH_CROSS, new cv.Size(3, 3), new cv.Point(-1, -1));
    const img = ink.clone();
    const eroded = new cv.Mat();
    const opened = new cv.Mat();
    const layer = new cv.Mat();
    // Peel the ink layer by layer; what each layer leaves behind together forms the centre line.
    for (let pass = 0; pass < 100 && cv.countNonZero(img) > 0; pass++) {
        cv.erode(img, eroded, kernel);
        cv.dilate(eroded, opened, kernel);
        cv.subtract(img, opened, layer);
        cv.bitwise_or(skel, layer, skel);
        eroded.copyTo(img);
    }
    const area = cv.countNonZero(ink);
    const length = Math.max(1, cv.countNonZero(skel));
    kernel.delete();
    img.delete();
    eroded.delete();
    opened.delete();
    layer.delete();
    skel.delete();
    return Math.max(1, area / length);
}

// The ink after closing (or opening) with a round kernel `strokes` wide.
function morph(ink: Mat, op: typeof cv.MORPH_CLOSE | typeof cv.MORPH_OPEN, strokes: number, thickness: number): Mat {
    const size = odd(strokes * thickness);
    const kernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(size, size), new cv.Point(-1, -1));
    const out = new cv.Mat();
    cv.morphologyEx(ink, out, op, kernel, new cv.Point(-1, -1), 1, cv.BORDER_CONSTANT, cv.morphologyDefaultBorderValue());
    kernel.delete();
    return out;
}

// The box grown by `by` pixels on every side, kept inside `ink`.
function grow(box: Rect, by: number, ink: Mat): Rect {
    const x0 = Math.max(0, box.x - by);
    const y0 = Math.max(0, box.y - by);
    return { x: x0, y: y0, width: Math.min(ink.cols, box.x + box.width + by) - x0, height: Math.min(ink.rows, box.y + box.height + by) - y0 };
}

// Grows boxes that overlap or lie within `gap` of each other into one, until none do.
function mergeNear(boxes: Rect[], gap: number): Rect[] {
    const out = boxes.map((box) => ({ ...box }));
    for (let merged = true; merged; ) {
        merged = false;
        for (let i = 0; i < out.length && !merged; i++) {
            for (let j = i + 1; j < out.length && !merged; j++) {
                if (!near(out[i], out[j], gap)) continue;
                const x0 = Math.min(out[i].x, out[j].x);
                const y0 = Math.min(out[i].y, out[j].y);
                const x1 = Math.max(out[i].x + out[i].width, out[j].x + out[j].width);
                const y1 = Math.max(out[i].y + out[i].height, out[j].y + out[j].height);
                out[i] = { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
                out.splice(j, 1);
                merged = true;
            }
        }
    }
    return out;
}

// The enclosed areas of the ink closed by `closeStrokes`: compact ones of a sensible size.
function enclosedAreas(ink: Mat, thickness: number, closeStrokes: number, minStrokes: number): Rect[] {
    const closed = morph(ink, cv.MORPH_CLOSE, closeStrokes, thickness);
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    // RETR_CCOMP also reports holes; hierarchy rows are [next, previous, first child, parent].
    cv.findContours(closed, contours, hierarchy, cv.RETR_CCOMP, cv.CHAIN_APPROX_SIMPLE);
    const found: Rect[] = [];
    for (let n = 0; n < contours.size(); n++) {
        if (hierarchy.data32S[n * 4 + 3] === -1) continue; // an outline, not a hole
        const contour = contours.get(n);
        const box = cv.boundingRect(contour);
        const size = longSide(box) / thickness;
        if (size >= minStrokes && size <= BODY_MAX_STROKES) {
            // Solidity: the hole's area over the area of its convex outline, 1 being a perfect blob.
            const hull = new cv.Mat();
            (cv.convexHull as (...args: unknown[]) => void)(contour, hull, false, true);
            const hullArea = cv.contourArea(hull, false);
            if (hullArea > 0 && cv.contourArea(contour, false) / hullArea >= BODY_MIN_SOLIDITY) found.push(box);
            hull.delete();
        }
        contour.delete();
    }
    contours.delete();
    hierarchy.delete();
    closed.delete();
    return found;
}

// Filled blocks: what is left of the ink once it is closed and then opened with a kernel wider than
// a stroke, keeping the ones big enough not to be a junction dot.
function solidBlocks(ink: Mat, thickness: number): Rect[] {
    const closed = morph(ink, cv.MORPH_CLOSE, SOLID_CLOSE_STROKES, thickness);
    const solid = morph(closed, cv.MORPH_OPEN, SOLID_OPEN_STROKES, thickness);
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(solid, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
    const found: Rect[] = [];
    for (let n = 0; n < contours.size(); n++) {
        const contour = contours.get(n);
        const box = cv.boundingRect(contour);
        contour.delete();
        if (longSide(box) < SOLID_MIN_STROKES * thickness || longSide(box) > BODY_MAX_STROKES * thickness || aspect(box) < SOLID_MIN_ASPECT) continue;
        const region = ink.roi(new cv.Rect(box.x, box.y, box.width, box.height));
        const fill = cv.countNonZero(region) / area(box);
        region.delete();
        if (fill >= SOLID_MIN_FILL) found.push(box);
    }
    contours.delete();
    hierarchy.delete();
    solid.delete();
    closed.delete();
    return found;
}

// One box per component, in pixels of `ink`, and how thick a pen stroke is there.
export function findComponents(ink: Mat): { boxes: Rect[]; thickness: number } {
    const thickness = strokeThickness(ink);
    const gap = MERGE_GAP_STROKES * thickness;

    // Bodies that a wide closing shows as one roughly square area, like a gate.
    const gates = enclosedAreas(ink, thickness, BODY_CLOSE_STROKES, RING_PIECE_STROKES).filter(
        (box) => longSide(box) >= BODY_MIN_STROKES * thickness && aspect(box) >= BODY_MIN_ASPECT,
    );
    // Rings that a light closing shows as pieces to be grouped, like a lamp's wedges.
    const reach = Math.round(RING_REACH_STROKES * thickness);
    const rings = mergeNear(enclosedAreas(ink, thickness, RING_CLOSE_STROKES, RING_PIECE_STROKES), gap)
        .filter((box) => longSide(box) >= RING_MIN_STROKES * thickness && longSide(box) <= BODY_MAX_STROKES * thickness && aspect(box) >= BODY_MIN_ASPECT)
        .map((box) => (longSide(box) > RING_SMALL_STROKES * thickness ? box : grow(box, reach, ink)));
    const bodies = [...gates, ...rings.filter((ring) => !gates.some((gate) => near(ring, gate, 0)))];
    const blocks = mergeNear(solidBlocks(ink, thickness), gap).filter((block) => !bodies.some((body) => near(block, body, 0)));

    // One box where boxes overlap, and none for a scrap hard against a much bigger box.
    const merged = mergeNear([...bodies, ...blocks], 0);
    const boxes = merged.filter((box) => !merged.some((other) => other !== box && area(other) >= SCRAP_RATIO * area(box) && near(box, other, gap)));

    // A little room around each component, for whoever looks at the crop.
    const pad = Math.round(COMPONENT_PAD_STROKES * thickness);
    // A component sits well inside the crop, which has room around the circuit; a box against the edge
    // is the table or the paper's edge, not a component.
    const edge = Math.round(EDGE_STROKES * thickness);
    const inside = boxes.filter((box) => box.x > edge && box.y > edge && box.x + box.width < ink.cols - edge && box.y + box.height < ink.rows - edge);
    const padded = inside
        .map((box) => grow(box, pad, ink))
        .filter((box) => area(box) <= COMPONENT_MAX_AREA_FRACTION * ink.cols * ink.rows);
    return { boxes: padded, thickness };
}
