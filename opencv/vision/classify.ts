// Guessing what a component is by comparing its ink to reference drawings of common symbols.
//
// Everything is reduced to a small, blurred picture of line art. A component's picture is compared
// to each symbol's picture in eight orientations (four turns, mirrored or not) by normalised
// correlation, so pen thickness and small wobbles do not matter much. The result is a label and a
// confidence between 0 and 1; whether that is high enough to trust is left to the caller.

import cv, { Mat } from "opencv-ts";
import { LABEL_MIN_CONFIDENCE, LABEL_MIN_GENERIC_CONFIDENCE, MATCH_BLUR_SIGMA, MATCH_SIZE, SIZE_MISMATCH } from "../config";
import type { Rect } from "../geometry/boxes";
import { isLead, SYMBOLS, type SymbolDrawing } from "./symbols";

// The best symbol for a component (its name, and a coarser one), and how well it matches (0 to 1).
export type Match = { label: string; family: string; confidence: number };

// What to call a component: the symbol's own name for a good match, its coarser name for a rough one
// (still a best guess), and nothing when there is no good guess at all.
export function nameOf(match: Match): string | null {
    if (match.confidence >= LABEL_MIN_CONFIDENCE) return match.label;
    return match.confidence >= LABEL_MIN_GENERIC_CONFIDENCE ? match.family : null;
}

// One reference picture: a symbol in one orientation.
type Reference = { label: string; family: string; aspect: number; strokes?: [number, number]; pixels: Float32Array };

// A 1-channel picture of line art (white on black), any size, as a blurred MATCH_SIZE square.
function describe(art: Mat): Float32Array {
    const small = new cv.Mat();
    const blurred = new cv.Mat();
    const floats = new cv.Mat();
    cv.resize(art, small, new cv.Size(MATCH_SIZE, MATCH_SIZE), 0, 0, cv.INTER_AREA);
    cv.GaussianBlur(small, blurred, new cv.Size(0, 0), MATCH_BLUR_SIGMA, MATCH_BLUR_SIGMA, cv.BORDER_DEFAULT);
    blurred.convertTo(floats, cv.CV_32F, 1 / 255, 0);
    const pixels = Float32Array.from(floats.data32F);
    small.delete();
    blurred.delete();
    floats.delete();
    return pixels;
}

const turn = (px: Float32Array): Float32Array => {
    const out = new Float32Array(px.length);
    for (let y = 0; y < MATCH_SIZE; y++) for (let x = 0; x < MATCH_SIZE; x++) out[x * MATCH_SIZE + (MATCH_SIZE - 1 - y)] = px[y * MATCH_SIZE + x];
    return out;
};
const mirror = (px: Float32Array): Float32Array => {
    const out = new Float32Array(px.length);
    for (let y = 0; y < MATCH_SIZE; y++) for (let x = 0; x < MATCH_SIZE; x++) out[y * MATCH_SIZE + (MATCH_SIZE - 1 - x)] = px[y * MATCH_SIZE + x];
    return out;
};

let references: Reference[] | null = null;

// One symbol's ink, cropped to its own bounds. Its width over height is the drawing's proportions.
function drawSymbol(parts: SymbolDrawing["parts"]): { art: Mat; aspect: number } {
    const size = 96;
    const at = (v: number) => Math.round(v * (size - 1));
    const white = new cv.Scalar(255);
    const full = new cv.Mat(size, size, cv.CV_8UC1, new cv.Scalar(0));
    for (const part of parts) {
        if (part.kind === "line") cv.line(full, new cv.Point(at(part.x0), at(part.y0)), new cv.Point(at(part.x1), at(part.y1)), white, 3);
        else if (part.kind === "circle") cv.circle(full, new cv.Point(at(part.x), at(part.y)), at(part.r), white, 3);
        else (cv.ellipse as (...args: unknown[]) => void)(full, new cv.Point(at(part.x), at(part.y)), new cv.Size(at(part.rx), at(part.ry)), 0, part.from, part.to, white, 3);
    }
    const bounds = cv.boundingRect(full);
    const art = full.roi(bounds).clone();
    full.delete();
    return { art, aspect: bounds.width / bounds.height };
}

// Every symbol, with and without its leads, in its eight orientations. Built once, on first use.
function buildReferences(): Reference[] {
    const list: Reference[] = [];
    for (const symbol of SYMBOLS) {
        const bodies = symbol.parts.filter((part) => !isLead(part));
        const variants = bodies.length > 0 && bodies.length < symbol.parts.length ? [symbol.parts, bodies] : [symbol.parts];
        for (const parts of variants) {
            const { art, aspect } = drawSymbol(parts);
            const pixels = describe(art);
            art.delete();
            for (const flipped of [false, true]) {
                let current = flipped ? mirror(pixels) : pixels;
                for (let quarter = 0; quarter < 4; quarter++) {
                    // Turned a quarter, a drawing's width and height swap.
                    list.push({ label: symbol.label, family: symbol.family ?? symbol.label, aspect: quarter % 2 === 0 ? aspect : 1 / aspect, strokes: symbol.strokes, pixels: current });
                    current = turn(current);
                }
            }
        }
    }
    return list;
}

// Normalised correlation of two pictures: 1 for the same drawing, about 0 for unrelated ones.
function correlation(a: Float32Array, b: Float32Array): number {
    let meanA = 0;
    let meanB = 0;
    for (let n = 0; n < a.length; n++) {
        meanA += a[n];
        meanB += b[n];
    }
    meanA /= a.length;
    meanB /= a.length;
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let n = 0; n < a.length; n++) {
        const da = a[n] - meanA;
        const db = b[n] - meanB;
        dot += da * db;
        normA += da * da;
        normB += db * db;
    }
    return normA > 0 && normB > 0 ? dot / Math.sqrt(normA * normB) : 0;
}

// The symbol that best matches the ink inside `box`, and how well (0 to 1). `ink` is white on black;
// `thickness` is a pen stroke's width there, which sets how big the box is in strokes.
export function classify(ink: Mat, box: Rect, thickness: number): Match {
    references ??= buildReferences();
    const region = ink.roi(new cv.Rect(box.x, box.y, box.width, box.height));
    const pixels = describe(region);
    region.delete();
    const boxAspect = box.width / box.height;
    const strokes = Math.max(box.width, box.height) / thickness;

    let best: Match = { label: "", family: "", confidence: 0 };
    for (const reference of references) {
        // A box of the wrong proportions is unlikely to hold this symbol, however the lines line up.
        const ratio = boxAspect / reference.aspect;
        const shape = 0.6 + 0.4 * Math.min(ratio, 1 / ratio);
        // A symbol of the wrong size for this box is less likely, too.
        const sized = reference.strokes === undefined || (strokes >= reference.strokes[0] && strokes <= reference.strokes[1]) ? 1 : SIZE_MISMATCH;
        const confidence = Math.max(0, correlation(pixels, reference.pixels)) * shape * sized;
        if (confidence > best.confidence) best = { label: reference.label, family: reference.family, confidence };
    }
    return best;
}
