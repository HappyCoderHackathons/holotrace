// Tracing the wires of a circuit: which components each drawn wire joins.
//
// Every component's box is wiped out of the ink, so what is left is wire (plus text and specks). Bits of ink
// that touch are one wire, so a junction dot simply joins the wires that meet at it. Each place a wire comes
// up to a component's box is a contact. The result is topology, "this wire touches these components, here",
// not a drawing: the app routes and edits the lines itself.
//
// Everything is sized in pen-stroke widths, and the tracing runs on a copy scaled so a stroke is a few pixels
// wide (see WIRE_TRACE_STROKE_PIXELS), so a big photo costs no more than a small one.

import cv, { type Mat } from "opencv-ts";
import type { Rect } from "./boxes";
import {
    WIRE_CLOSE_STROKES,
    WIRE_CONTACT_MERGE_STROKES,
    WIRE_CONTACT_REACH_STROKES,
    WIRE_MIN_STROKES,
    WIRE_TRACE_STROKE_PIXELS,
} from "./config";
import { odd } from "./ink";

export type Point = { x: number; y: number };

// Where a wire meets a component: the index of the component's box, and the point, in pixels of the ink.
export type Contact = { component: number; x: number; y: number };

// One drawn wire: the components it touches, and a point on the wire itself (near its contacts), which is where a
// junction node goes when the wire joins three or more things.
export type Net = { contacts: Contact[]; centre: Point };

export function traceWires(ink: Mat, boxes: Rect[], thickness: number): Net[] {
    const scale = Math.min(1, WIRE_TRACE_STROKE_PIXELS / Math.max(1, thickness));
    const stroke = thickness * scale;

    // A working copy at the tracing scale, with every component wiped out of it.
    const work = new cv.Mat();
    if (scale < 1) {
        const small = new cv.Mat();
        cv.resize(ink, small, new cv.Size(Math.max(1, Math.round(ink.cols * scale)), Math.max(1, Math.round(ink.rows * scale))), 0, 0, cv.INTER_AREA);
        cv.threshold(small, work, 60, 255, cv.THRESH_BINARY);
        small.delete();
    } else {
        ink.copyTo(work);
    }
    const width = work.cols;
    const height = work.rows;
    const area = boxes.map((box) => ({
        x0: Math.max(0, Math.floor(box.x * scale)),
        y0: Math.max(0, Math.floor(box.y * scale)),
        x1: Math.min(width, Math.ceil((box.x + box.width) * scale)),
        y1: Math.min(height, Math.ceil((box.y + box.height) * scale)),
    }));
    for (const box of area) cv.rectangle(work, new cv.Point(box.x0, box.y0), new cv.Point(box.x1 - 1, box.y1 - 1), new cv.Scalar(0), cv.FILLED);

    // Bridge the small gaps of a hand-drawn wire, then find the pieces of ink that are joined up.
    const gap = odd(Math.max(3, WIRE_CLOSE_STROKES * stroke));
    const kernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(gap, gap), new cv.Point(-1, -1));
    const closed = new cv.Mat();
    cv.morphologyEx(work, closed, cv.MORPH_CLOSE, kernel, new cv.Point(-1, -1), 1, cv.BORDER_CONSTANT, cv.morphologyDefaultBorderValue());
    const labels = new cv.Mat();
    const count = (cv.connectedComponents as (...args: unknown[]) => number)(closed, labels, 8, cv.CV_32S);
    const label = labels.data32S;

    // Size of every piece, so specks and text can be told from wires.
    const minX = new Int32Array(count).fill(width);
    const minY = new Int32Array(count).fill(height);
    const maxX = new Int32Array(count).fill(-1);
    const maxY = new Int32Array(count).fill(-1);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const l = label[y * width + x];
            if (l === 0) continue;
            if (x < minX[l]) minX[l] = x;
            if (x > maxX[l]) maxX[l] = x;
            if (y < minY[l]) minY[l] = y;
            if (y > maxY[l]) maxY[l] = y;
        }
    }
    const isWire = (l: number) => Math.max(maxX[l] - minX[l] + 1, maxY[l] - minY[l] + 1) >= WIRE_MIN_STROKES * stroke;

    // Contacts: the wire ink in a ring just outside each box, grouped into one contact per place a wire arrives.
    const reach = Math.max(2, Math.round(WIRE_CONTACT_REACH_STROKES * stroke));
    const mergeDistance = WIRE_CONTACT_MERGE_STROKES * stroke;
    const contactsOf = new Map<number, Contact[]>();
    area.forEach((box, component) => {
        const points = new Map<number, Point[]>();
        for (let y = Math.max(0, box.y0 - reach); y < Math.min(height, box.y1 + reach); y++) {
            for (let x = Math.max(0, box.x0 - reach); x < Math.min(width, box.x1 + reach); x++) {
                if (x >= box.x0 && x < box.x1 && y >= box.y0 && y < box.y1) continue;
                const l = label[y * width + x];
                if (l === 0 || !isWire(l)) continue;
                const list = points.get(l) ?? [];
                list.push({ x, y });
                points.set(l, list);
            }
        }
        for (const [l, list] of points) {
            const clusters: { sx: number; sy: number; n: number }[] = [];
            for (const point of list) {
                const near = clusters.find((c) => Math.hypot(c.sx / c.n - point.x, c.sy / c.n - point.y) <= mergeDistance);
                if (near) {
                    near.sx += point.x;
                    near.sy += point.y;
                    near.n++;
                } else clusters.push({ sx: point.x, sy: point.y, n: 1 });
            }
            for (const c of clusters) {
                if (c.n < 3) continue; // a corner clipping the ring, not a wire arriving
                const found = contactsOf.get(l) ?? [];
                found.push({ component, x: c.sx / c.n / scale, y: c.sy / c.n / scale });
                contactsOf.set(l, found);
            }
        }
    });

    // One net per wire with contacts, with a point on the wire nearest to where its contacts are.
    const nets: Net[] = [];
    for (const [l, contacts] of [...contactsOf].sort((a, b) => a[0] - b[0])) {
        const targetX = (contacts.reduce((sum, c) => sum + c.x, 0) / contacts.length) * scale;
        const targetY = (contacts.reduce((sum, c) => sum + c.y, 0) / contacts.length) * scale;
        let best = { x: targetX, y: targetY, d: Infinity };
        for (let y = minY[l]; y <= maxY[l]; y++) {
            for (let x = minX[l]; x <= maxX[l]; x++) {
                if (label[y * width + x] !== l) continue;
                const d = Math.hypot(x - targetX, y - targetY);
                if (d < best.d) best = { x, y, d };
            }
        }
        nets.push({ contacts, centre: { x: best.x / scale, y: best.y / scale } });
    }

    work.delete();
    kernel.delete();
    closed.delete();
    labels.delete();
    return nets;
}
