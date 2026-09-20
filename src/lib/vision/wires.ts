// Tracing the wires of a circuit: what each drawn wire joins, as topology, not a drawing.
//
// Every component's box is wiped out of the ink, so what is left is wire (plus text and specks). The wires are
// thinned to a one-pixel skeleton, and the places where lines meet are looked at one by one:
//
//   - a dot (the ink is filled in around the point) or a T is a junction: a node, where everything that meets joins;
//   - four lines meeting with no dot are two wires crossing, and each goes straight through without joining;
//   - two lines meeting are just a bend.
//
// Each place a wire comes up to a component's box is a contact. The result says which contacts and junctions are
// linked to which; the app routes and draws the lines itself.
//
// Everything is sized in pen-stroke widths, and the tracing runs on a copy scaled so a stroke is a few pixels wide
// (see WIRE_TRACE_STROKE_PIXELS), so a big photo costs no more than a small one.

import cv, { type Mat } from "opencv-ts";
import type { Rect } from "./boxes";
import {
    WIRE_ARM_STROKES,
    WIRE_ATTACH_STROKES,
    WIRE_CLOSE_STROKES,
    WIRE_CONTACT_MERGE_STROKES,
    WIRE_CONTACT_REACH_STROKES,
    WIRE_DOT_FILL,
    WIRE_DOT_STROKES,
    WIRE_JUNCTION_MERGE_STROKES,
    WIRE_MIN_STROKES,
    WIRE_SPUR_STROKES,
    WIRE_TRACE_STROKE_PIXELS,
} from "./config";
import { odd } from "./ink";

export type Point = { x: number; y: number };

// Where a wire meets a component: the index of the component's box, and the point, in pixels of the ink.
export type Contact = { component: number; x: number; y: number };

// One end of a link: a contact (an index into `contacts`) or a junction (an index into `nodes`).
export type WireEnd = { contact: number } | { node: number };

export type WireGraph = {
    contacts: Contact[];
    // Junctions, in pixels of the ink, on the wire.
    nodes: Point[];
    // What is joined to what, directly along a drawn wire with no other junction between.
    links: [WireEnd, WireEnd][];
};

const DIRECTIONS = [
    [0, -1],
    [1, -1],
    [1, 0],
    [1, 1],
    [0, 1],
    [-1, 1],
    [-1, 0],
    [-1, -1],
] as const;

// Thins a 0/1 picture to a one-pixel-wide skeleton (Zhang and Suen), in place.
function thin(image: Uint8Array, width: number, height: number) {
    const at = (x: number, y: number) => (x < 0 || y < 0 || x >= width || y >= height ? 0 : image[y * width + x]);
    for (let changed = true, guard = 0; changed && guard < 60; guard++) {
        changed = false;
        for (let pass = 0; pass < 2; pass++) {
            const remove: number[] = [];
            for (let y = 1; y < height - 1; y++) {
                for (let x = 1; x < width - 1; x++) {
                    if (image[y * width + x] === 0) continue;
                    const n = DIRECTIONS.map(([dx, dy]) => at(x + dx, y + dy));
                    const count = n.reduce((a, b) => a + b, 0);
                    if (count < 2 || count > 6) continue;
                    let transitions = 0;
                    for (let k = 0; k < 8; k++) if (n[k] === 0 && n[(k + 1) % 8] === 1) transitions++;
                    if (transitions !== 1) continue;
                    // n: 0 N, 1 NE, 2 E, 3 SE, 4 S, 5 SW, 6 W, 7 NW
                    const first = pass === 0 ? n[0] * n[2] * n[4] : n[0] * n[2] * n[6];
                    const second = pass === 0 ? n[2] * n[4] * n[6] : n[0] * n[4] * n[6];
                    if (first === 0 && second === 0) remove.push(y * width + x);
                }
            }
            for (const index of remove) image[index] = 0;
            if (remove.length > 0) changed = true;
        }
    }
}

// Union-find over integers.
class Sets {
    private parent: number[];
    constructor(size: number) {
        this.parent = Array.from({ length: size }, (_, n) => n);
    }
    find(a: number): number {
        while (this.parent[a] !== a) {
            this.parent[a] = this.parent[this.parent[a]];
            a = this.parent[a];
        }
        return a;
    }
    join(a: number, b: number) {
        this.parent[this.find(a)] = this.find(b);
    }
}

export function traceWires(ink: Mat, boxes: Rect[], thickness: number): WireGraph {
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

    // Bridge the small gaps of a hand-drawn wire, and tell the pieces of ink that are joined up apart.
    const gap = odd(Math.max(3, WIRE_CLOSE_STROKES * stroke));
    const kernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(gap, gap), new cv.Point(-1, -1));
    const closed = new cv.Mat();
    cv.morphologyEx(work, closed, cv.MORPH_CLOSE, kernel, new cv.Point(-1, -1), 1, cv.BORDER_CONSTANT, cv.morphologyDefaultBorderValue());
    const labels = new cv.Mat();
    const count = (cv.connectedComponents as (...args: unknown[]) => number)(closed, labels, 8, cv.CV_32S);
    const label = labels.data32S;
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
    // The wire ink as 0/1 (specks and text dropped), kept for measuring dots, and its skeleton.
    const mask = new Uint8Array(width * height);
    for (let n = 0; n < mask.length; n++) mask[n] = label[n] !== 0 && isWire(label[n]) ? 1 : 0;
    const skeleton = Uint8Array.from(mask);
    thin(skeleton, width, height);

    // ---- Contacts: the wire ink in a ring just outside each box, one contact per place a wire arrives ----
    const reach = Math.max(2, Math.round(WIRE_CONTACT_REACH_STROKES * stroke));
    const mergeDistance = WIRE_CONTACT_MERGE_STROKES * stroke;
    const contactPoints: (Point & { component: number })[] = [];
    area.forEach((box, component) => {
        const rings = new Map<number, Point[]>();
        for (let y = Math.max(0, box.y0 - reach); y < Math.min(height, box.y1 + reach); y++) {
            for (let x = Math.max(0, box.x0 - reach); x < Math.min(width, box.x1 + reach); x++) {
                if (x >= box.x0 && x < box.x1 && y >= box.y0 && y < box.y1) continue;
                if (mask[y * width + x] === 0) continue;
                const list = rings.get(label[y * width + x]) ?? [];
                list.push({ x, y });
                rings.set(label[y * width + x], list);
            }
        }
        for (const list of rings.values()) {
            const clusters: { sx: number; sy: number; n: number }[] = [];
            for (const p of list) {
                const near = clusters.find((c) => Math.hypot(c.sx / c.n - p.x, c.sy / c.n - p.y) <= mergeDistance);
                if (near) {
                    near.sx += p.x;
                    near.sy += p.y;
                    near.n++;
                } else clusters.push({ sx: p.x, sy: p.y, n: 1 });
            }
            for (const c of clusters) if (c.n >= 3) contactPoints.push({ x: c.sx / c.n, y: c.sy / c.n, component });
        }
    });

    // ---- Junctions: where skeleton lines meet ----
    const isSkeleton = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height && skeleton[y * width + x] === 1;
    const branchPixel = (x: number, y: number) => {
        const n = DIRECTIONS.map(([dx, dy]) => (isSkeleton(x + dx, y + dy) ? 1 : 0));
        let transitions = 0;
        for (let k = 0; k < 8; k++) if (n[k] === 0 && n[(k + 1) % 8] === 1) transitions++;
        return transitions >= 3;
    };
    const junctionPixels: number[] = [];
    for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) if (skeleton[y * width + x] === 1 && branchPixel(x, y)) junctionPixels.push(y * width + x);
    const merge = Math.max(1.5, WIRE_JUNCTION_MERGE_STROKES * stroke);
    const junctionSets = new Sets(junctionPixels.length);
    for (let a = 0; a < junctionPixels.length; a++) {
        for (let b = a + 1; b < junctionPixels.length; b++) {
            const dx = (junctionPixels[a] % width) - (junctionPixels[b] % width);
            const dy = Math.floor(junctionPixels[a] / width) - Math.floor(junctionPixels[b] / width);
            if (Math.hypot(dx, dy) <= merge) junctionSets.join(a, b);
        }
    }
    const clusterOf = new Map<number, number>();
    const members: number[][] = [];
    junctionPixels.forEach((pixel, n) => {
        const root = junctionSets.find(n);
        if (!clusterOf.has(root)) {
            clusterOf.set(root, members.length);
            members.push([]);
        }
        members[clusterOf.get(root)!].push(pixel);
    });
    const clusters = members.map((pixels) => {
        const xs = pixels.map((p) => p % width);
        const ys = pixels.map((p) => Math.floor(p / width));
        const x = xs.reduce((a, b) => a + b, 0) / xs.length;
        const y = ys.reduce((a, b) => a + b, 0) / ys.length;
        const radius = Math.max(...xs.map((px, k) => Math.hypot(px - x, ys[k] - y)));
        return { x, y, cut: radius + Math.max(1.5, 0.8 * stroke) };
    });
    // A junction cluster owns every skeleton pixel within its cut radius; what is left of the skeleton is branches.
    const owner = new Int32Array(width * height).fill(-1);
    clusters.forEach((c, id) => {
        for (let y = Math.max(0, Math.floor(c.y - c.cut)); y <= Math.min(height - 1, Math.ceil(c.y + c.cut)); y++) {
            for (let x = Math.max(0, Math.floor(c.x - c.cut)); x <= Math.min(width - 1, Math.ceil(c.x + c.cut)); x++) {
                if (skeleton[y * width + x] === 1 && Math.hypot(x - c.x, y - c.y) <= c.cut && owner[y * width + x] === -1) owner[y * width + x] = id;
            }
        }
    });
    const branchOf = new Int32Array(width * height).fill(-1);
    const branches: number[][] = [];
    for (let start = 0; start < skeleton.length; start++) {
        if (skeleton[start] === 0 || owner[start] !== -1 || branchOf[start] !== -1) continue;
        const id = branches.length;
        const pixels: number[] = [];
        const stack = [start];
        branchOf[start] = id;
        while (stack.length > 0) {
            const p = stack.pop()!;
            pixels.push(p);
            const x = p % width;
            const y = Math.floor(p / width);
            for (const [dx, dy] of DIRECTIONS) {
                const q = (y + dy) * width + (x + dx);
                if (isSkeleton(x + dx, y + dy) && owner[q] === -1 && branchOf[q] === -1) {
                    branchOf[q] = id;
                    stack.push(q);
                }
            }
        }
        branches.push(pixels);
    }
    // Which branches touch which cluster.
    const touching: Set<number>[] = clusters.map(() => new Set<number>());
    const touchedBy: Set<number>[] = branches.map(() => new Set<number>());
    for (let p = 0; p < owner.length; p++) {
        if (owner[p] === -1) continue;
        const x = p % width;
        const y = Math.floor(p / width);
        for (const [dx, dy] of DIRECTIONS) {
            if (x + dx < 0 || y + dy < 0 || x + dx >= width || y + dy >= height) continue;
            const b = branchOf[(y + dy) * width + (x + dx)];
            if (b !== -1) {
                touching[owner[p]].add(b);
                touchedBy[b].add(owner[p]);
            }
        }
    }

    // ---- Contacts attach to the nearest bit of skeleton ----
    const attachRadius = Math.max(3, WIRE_ATTACH_STROKES * stroke);
    const attached = contactPoints.map((c) => {
        let best: { p: number; d: number } | null = null;
        for (let y = Math.max(0, Math.floor(c.y - attachRadius)); y <= Math.min(height - 1, Math.ceil(c.y + attachRadius)); y++) {
            for (let x = Math.max(0, Math.floor(c.x - attachRadius)); x <= Math.min(width - 1, Math.ceil(c.x + attachRadius)); x++) {
                if (skeleton[y * width + x] === 0) continue;
                const d = Math.hypot(x - c.x, y - c.y);
                if (d <= attachRadius && (best === null || d < best.d)) best = { p: y * width + x, d };
            }
        }
        return best?.p ?? -1;
    });
    const contactBranches: Set<number>[] = branches.map(() => new Set<number>());
    const contactClusters: Set<number>[] = clusters.map(() => new Set<number>());
    attached.forEach((p, i) => {
        if (p === -1) return;
        if (owner[p] !== -1) contactClusters[owner[p]].add(i);
        else contactBranches[branchOf[p]].add(i);
    });

    // ---- Prune skeleton spurs: short dead-end twigs off a junction (a rough pen edge), when nothing is attached ----
    const spur = WIRE_SPUR_STROKES * stroke;
    const removed = new Set<number>();
    branches.forEach((pixels, b) => {
        if (pixels.length < spur && touchedBy[b].size === 1 && contactBranches[b].size === 0) removed.add(b);
    });
    for (const b of removed) for (const c of touchedBy[b]) touching[c].delete(b);

    // ---- What each junction is: a node, two lines crossing, or a bend ----
    const dotRadius = WIRE_DOT_STROKES * stroke;
    const filled = (c: { x: number; y: number }) => {
        let ink = 0;
        let total = 0;
        for (let y = Math.max(0, Math.floor(c.y - dotRadius)); y <= Math.min(height - 1, Math.ceil(c.y + dotRadius)); y++) {
            for (let x = Math.max(0, Math.floor(c.x - dotRadius)); x <= Math.min(width - 1, Math.ceil(c.x + dotRadius)); x++) {
                if (Math.hypot(x - c.x, y - c.y) > dotRadius) continue;
                total++;
                ink += mask[y * width + x];
            }
        }
        return total === 0 ? 0 : ink / total;
    };
    const armAngle = (cluster: { x: number; y: number }, b: number) => {
        const target = WIRE_ARM_STROKES * stroke;
        let best = { d: Infinity, p: branches[b][0] };
        for (const p of branches[b]) {
            const d = Math.abs(Math.hypot((p % width) - cluster.x, Math.floor(p / width) - cluster.y) - target);
            if (d < best.d) best = { d, p };
        }
        return Math.atan2(Math.floor(best.p / width) - cluster.y, (best.p % width) - cluster.x);
    };
    const branchSets = new Sets(branches.length);
    const kind: ("node" | "through" | "ignore")[] = clusters.map(() => "ignore");
    clusters.forEach((cluster, id) => {
        const arms = [...touching[id]].filter((b) => !removed.has(b));
        const withContacts = arms.length + contactClusters[id].size;
        if (arms.length === 2) {
            branchSets.join(arms[0], arms[1]);
            kind[id] = "through";
        } else if (arms.length === 4 && filled(cluster) < WIRE_DOT_FILL && contactClusters[id].size === 0) {
            // Two wires crossing: opposite arms are one wire each.
            const angles = arms.map((b) => armAngle(cluster, b));
            const pairings: [number, number, number, number][] = [[0, 1, 2, 3], [0, 2, 1, 3], [0, 3, 1, 2]];
            const score = (p: [number, number, number, number]) => -Math.cos(angles[p[0]] - angles[p[1]]) - Math.cos(angles[p[2]] - angles[p[3]]);
            const best = pairings.reduce((a, b) => (score(b) > score(a) ? b : a));
            branchSets.join(arms[best[0]], arms[best[1]]);
            branchSets.join(arms[best[2]], arms[best[3]]);
            kind[id] = "through";
        } else if (withContacts >= 3 || arms.length >= 3) {
            kind[id] = "node";
        }
    });

    // ---- Each drawn wire (branches joined through bends and crossings) links the things on it ----
    const nodeIndex = new Map<number, number>();
    const nodes: Point[] = [];
    clusters.forEach((c, id) => {
        if (kind[id] === "node") {
            nodeIndex.set(id, nodes.length);
            nodes.push({ x: c.x / scale, y: c.y / scale });
        }
    });
    const contacts: Contact[] = contactPoints.map((c) => ({ component: c.component, x: c.x / scale, y: c.y / scale }));

    const wireOf = (b: number) => branchSets.find(b);
    const thingsOn = new Map<number, { end: WireEnd; at: number }[]>();
    const put = (b: number, end: WireEnd, at: number) => {
        const list = thingsOn.get(wireOf(b)) ?? [];
        const key = "contact" in end ? `c${end.contact}` : `n${end.node}`;
        if (!list.some((t) => ("contact" in t.end ? `c${t.end.contact}` : `n${t.end.node}`) === key)) list.push({ end, at });
        thingsOn.set(wireOf(b), list);
    };
    branches.forEach((pixels, b) => {
        if (removed.has(b)) return;
        for (const c of touchedBy[b]) if (kind[c] === "node") put(b, { node: nodeIndex.get(c)! }, clusters[c].y * width + clusters[c].x);
        for (const i of contactBranches[b]) put(b, { contact: i }, attached[i]);
    });
    // A contact right at a junction (inside its cut radius) joins that junction's node, or the wire it bends onto.
    clusters.forEach((_, c) => {
        for (const i of contactClusters[c]) {
            if (kind[c] === "node") {
                const arm = [...touching[c]].find((b) => !removed.has(b));
                if (arm !== undefined) put(arm, { contact: i }, attached[i]);
                put(arm ?? 0, { node: nodeIndex.get(c)! }, clusters[c].y * width + clusters[c].x);
            } else {
                const arm = [...touching[c]].find((b) => !removed.has(b));
                if (arm !== undefined) put(arm, { contact: i }, attached[i]);
            }
        }
    });

    // Along one wire the things are in a line: link each to the next, in order along the wire.
    const links: [WireEnd, WireEnd][] = [];
    const skeletonDistance = (from: number) => {
        const dist = new Int32Array(width * height).fill(-1);
        const queue = [from];
        dist[from] = 0;
        for (let head = 0; head < queue.length; head++) {
            const p = queue[head];
            const x = p % width;
            const y = Math.floor(p / width);
            for (const [dx, dy] of DIRECTIONS) {
                const q = (y + dy) * width + (x + dx);
                if (isSkeleton(x + dx, y + dy) && dist[q] === -1) {
                    dist[q] = dist[p] + 1;
                    queue.push(q);
                }
            }
        }
        return dist;
    };
    const nearestSkeleton = (p: number) => {
        if (skeleton[p] === 1) return p;
        for (let r = 1; r < 6; r++) {
            for (let dy = -r; dy <= r; dy++) {
                for (let dx = -r; dx <= r; dx++) {
                    const q = ((Math.floor(p / width) + dy) * width) + ((p % width) + dx);
                    if (q >= 0 && q < skeleton.length && skeleton[q] === 1) return q;
                }
            }
        }
        return p;
    };
    for (const list of thingsOn.values()) {
        if (list.length < 2) continue;
        if (list.length === 2) {
            links.push([list[0].end, list[1].end]);
            continue;
        }
        const points = list.map((t) => nearestSkeleton(t.at));
        const first = skeletonDistance(points[0]);
        const far = points.reduce((best, p, n) => (first[p] > first[points[best]] ? n : best), 0);
        const fromEnd = skeletonDistance(points[far]);
        const ordered = list.map((t, n) => ({ t, d: fromEnd[points[n]] })).sort((a, b) => a.d - b.d);
        for (let n = 0; n + 1 < ordered.length; n++) links.push([ordered[n].t.end, ordered[n + 1].t.end]);
    }

    // A junction with only two things joined to it is just a bend in a wire: take it out.
    const degree = (end: WireEnd) => links.filter(([a, b]) => same(a, end) || same(b, end));
    function same(a: WireEnd, b: WireEnd) {
        return ("node" in a && "node" in b && a.node === b.node) || ("contact" in a && "contact" in b && a.contact === b.contact);
    }
    const dropped = new Set<number>();
    for (let n = 0; n < nodes.length; n++) {
        const here = degree({ node: n });
        if (here.length === 2) {
            const others = here.map(([a, b]) => (same(a, { node: n }) ? b : a));
            for (const link of here) links.splice(links.indexOf(link), 1);
            links.push([others[0], others[1]]);
            dropped.add(n);
        } else if (here.length < 2) {
            for (const link of here) links.splice(links.indexOf(link), 1);
            dropped.add(n);
        }
    }
    // Renumber the nodes that are left.
    const renumber = new Map<number, number>();
    const keptNodes = nodes.filter((_, n) => {
        if (dropped.has(n)) return false;
        renumber.set(n, renumber.size);
        return true;
    });
    const fix = (end: WireEnd): WireEnd => ("node" in end ? { node: renumber.get(end.node)! } : end);
    const finalLinks = links.filter(([a, b]) => !same(a, b)).map(([a, b]): [WireEnd, WireEnd] => [fix(a), fix(b)]);

    work.delete();
    kernel.delete();
    closed.delete();
    labels.delete();
    return { contacts, nodes: keptNodes, links: finalLinks };
}
