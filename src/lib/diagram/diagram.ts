// The diagram: the final components of a circuit and how they are wired, in the shape of Wokwi's diagram.json.
//
//   { "version": 1, "author": "holotrace", "editor": "holotrace",
//     "parts": [ { "type": "holotrace-resistor", "id": "R1", "top": 210, "left": 388, "rotate": 90, "attrs": { "value": "220Ω" } } ],
//     "connections": [ ["D1:a", "R1:2", "green", []] ],
//     "dependencies": {} }
//
// Parts are placed by the top-left of their box (a junction, by its point) in canvas units. A connection joins two
// endpoints, each "part:pin", with a colour and routing hints (empty: the editor routes the wire). A junction where
// a wire is joined by others is a tiny part of type holotrace-node with one pin, `n`, so a file is only parts and
// connections. Wiring is topology, "which connects to what"; the editor draws and edits the lines.
//
// This file builds a diagram from what the vision code found, and checks one that is read in. Pure, no OpenCV.

import type { Orientation } from "../vision/classify";
import { ORIENTATION_MIN_SCORE } from "../vision/config";
import type { Component } from "../vision/reconcile";
import type { Net } from "../vision/wires";
import { GENERIC_TYPE, NODE_TYPE, partByType, partForLabel, type PartDef, type PinDef, pinsOf } from "./parts";

export const DIAGRAM_VERSION = 1;

// The median part is drawn this big (canvas units), and the circuit is centred here.
export const PART_TARGET_SIZE = 64;
export const CANVAS_CENTRE = { x: 480, y: 300 };

export type Rotation = 0 | 90 | 180 | 270;
export interface DiagramPart {
    type: string;
    id: string;
    top: number;
    left: number;
    rotate?: Rotation;
    attrs: Record<string, string | number | boolean>;
}
// [from "part:pin", to "part:pin", colour, routing hints]
export type DiagramConnection = [string, string, string, string[]];
export interface Diagram {
    version: number;
    author: string;
    editor: string;
    parts: DiagramPart[];
    connections: DiagramConnection[];
    dependencies: Record<string, unknown>;
}

// ---- Building a diagram from what was found in a photo ----

export interface BuildInput {
    // The final components (from reconcile), in the order the nets' contacts index them.
    components: Component[];
    // How each is turned, when known.
    orientations: (Orientation | null)[];
    nets: Net[];
}

// Everything below is in pixels of the photo, for drawing over it.
export interface BuildOverlay {
    pins: { part: string; pin: string; x: number; y: number }[];
    links: { x1: number; y1: number; x2: number; y2: number; colour: string }[];
    nodes: { id: string; x: number; y: number }[];
}

export interface BuildReport {
    parts: number;
    connections: number;
    nodes: number;
    // Wires that reach one part and go no further.
    dangling: { part: string; pin: string }[];
    // Contacts with no pin free for them (more wires than the part has pins).
    unassigned: number;
    // Parts nothing is wired to.
    loose: string[];
    overlay: BuildOverlay;
}

type Point = { x: number; y: number };

// A part's pin, turned and mirrored the way the editor does it (mirror first, then a clockwise turn), as an offset.
function turned(pin: PinDef, rotation: Rotation, mirrored: boolean): Point {
    const radians = (rotation * Math.PI) / 180;
    const x = pin.x * (mirrored ? -1 : 1);
    return { x: x * Math.cos(radians) - pin.y * Math.sin(radians), y: x * Math.sin(radians) + pin.y * Math.cos(radians) };
}

function wireColour(endpoints: string[]): string {
    if (endpoints.some((e) => e.startsWith("BAT") && e.endsWith(":pos"))) return "red";
    if (endpoints.some((e) => (e.startsWith("BAT") && e.endsWith(":neg")) || e.startsWith("GND"))) return "black";
    return "green";
}

// Builds the diagram of a circuit: its parts (placed and named), and a connection for every wire between two parts,
// or a junction node where a wire joins three or more.
export function buildDiagram({ components, orientations, nets }: BuildInput): { diagram: Diagram; report: BuildReport } {
    const sizes = components.map((c) => Math.max(c.box.x1 - c.box.x0, c.box.y1 - c.box.y0)).sort((a, b) => a - b);
    const median = sizes[Math.floor(sizes.length / 2)] || 1;
    // Image pixels to canvas units, and the middle of the circuit to the middle of the canvas.
    const scale = PART_TARGET_SIZE / median;
    const centres = components.map((c) => ({ x: (c.box.x0 + c.box.x1) / 2, y: (c.box.y0 + c.box.y1) / 2 }));
    const middle = centres.length
        ? { x: (Math.min(...centres.map((p) => p.x)) + Math.max(...centres.map((p) => p.x))) / 2, y: (Math.min(...centres.map((p) => p.y)) + Math.max(...centres.map((p) => p.y))) / 2 }
        : { x: 0, y: 0 };
    const toCanvas = (p: Point): Point => ({ x: CANVAS_CENTRE.x + (p.x - middle.x) * scale, y: CANVAS_CENTRE.y + (p.y - middle.y) * scale });

    // Contacts by component, so generic parts can be given as many pins as wires that reach them.
    const contactsByComponent = components.map(() => [] as { net: number; x: number; y: number }[]);
    nets.forEach((net, n) => net.contacts.forEach((c) => contactsByComponent[c.component]?.push({ net: n, x: c.x, y: c.y })));

    // Parts, named in reading order.
    const order = components.map((_, n) => n).sort((a, b) => centres[a].y - centres[b].y || centres[a].x - centres[b].x);
    const counters = new Map<string, number>();
    type Placed = { index: number; def: PartDef; id: string; rotation: Rotation; mirrored: boolean; attrs: DiagramPart["attrs"]; centre: Point; pins: PinDef[] };
    const placed: Placed[] = [];
    for (const index of order) {
        const component = components[index];
        const def = partForLabel(component.label);
        const count = (counters.get(def.refPrefix) ?? 0) + 1;
        counters.set(def.refPrefix, count);
        const width = component.box.x1 - component.box.x0;
        const height = component.box.y1 - component.box.y0;
        const guess = orientations[index];
        const believed = def.directional && guess && guess.score >= ORIENTATION_MIN_SCORE ? guess : null;
        // A part of unknown turn lies along its longer side: a tall box is a part turned a quarter.
        const rotation: Rotation = believed ? believed.rotation : def.pins.length === 2 && height > width * 1.2 ? 90 : 0;
        const attrs: DiagramPart["attrs"] = { ...def.attrs };
        if (def.type === GENERIC_TYPE) {
            attrs.label = component.label;
            const wires = contactsByComponent[index].length;
            if (wires > 2) attrs.pins = Math.min(16, wires);
        }
        if (believed?.mirrored) attrs.mirror = true;
        placed.push({ index, def, id: `${def.refPrefix}${count}`, rotation, mirrored: believed?.mirrored ?? false, attrs, centre: centres[index], pins: pinsOf(def, attrs) });
    }

    // Each contact goes to the nearest pin of its part; a pin belongs to one wire only.
    const pinAt = (part: Placed, pin: PinDef): Point => {
        const offset = turned(pin, part.rotation, part.mirrored);
        return { x: part.centre.x + offset.x / scale, y: part.centre.y + offset.y / scale };
    };
    const endpoints = nets.map(() => new Set<string>());
    const pinPoints = new Map<string, Point>();
    let unassigned = 0;
    for (const part of placed) {
        const contacts = contactsByComponent[part.index];
        const pairs = contacts
            .flatMap((contact, c) => part.pins.map((pin) => ({ c, contact, pin, d: Math.hypot(pinAt(part, pin).x - contact.x, pinAt(part, pin).y - contact.y) })))
            .sort((a, b) => a.d - b.d);
        const done = new Set<number>();
        const owner = new Map<string, number>();
        for (const { c, contact, pin } of pairs) {
            if (done.has(c) || (owner.has(pin.id) && owner.get(pin.id) !== contact.net)) continue;
            done.add(c);
            owner.set(pin.id, contact.net);
            endpoints[contact.net].add(`${part.id}:${pin.id}`);
            pinPoints.set(`${part.id}:${pin.id}`, pinAt(part, pin));
        }
        unassigned += contacts.length - done.size;
    }

    // Wires: one connection between two parts, a junction node where three or more meet.
    const parts: DiagramPart[] = [];
    const connections: DiagramConnection[] = [];
    const overlay: BuildOverlay = { pins: [], links: [], nodes: [] };
    const dangling: BuildReport["dangling"] = [];
    let nodeCount = 0;
    nets.forEach((net, n) => {
        const list = [...endpoints[n]];
        if (list.length === 1) {
            const [part, pin] = list[0].split(":");
            dangling.push({ part, pin });
            return;
        }
        const colour = wireColour(list);
        if (list.length === 2) {
            connections.push([list[0], list[1], colour, []]);
            const [a, b] = [pinPoints.get(list[0])!, pinPoints.get(list[1])!];
            overlay.links.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, colour });
        } else if (list.length >= 3) {
            const id = `n${++nodeCount}`;
            const at = toCanvas(net.centre);
            parts.push({ type: NODE_TYPE, id, top: Math.round(at.y), left: Math.round(at.x), attrs: {} });
            overlay.nodes.push({ id, x: net.centre.x, y: net.centre.y });
            for (const endpoint of list) {
                connections.push([endpoint, `${id}:n`, colour, []]);
                const p = pinPoints.get(endpoint)!;
                overlay.links.push({ x1: p.x, y1: p.y, x2: net.centre.x, y2: net.centre.y, colour });
            }
        }
    });

    for (const [id, point] of pinPoints) overlay.pins.push({ part: id.split(":")[0], pin: id.split(":")[1], x: point.x, y: point.y });

    // The parts themselves (nodes were added above, so they come last in the file).
    const partList: DiagramPart[] = placed.map((part) => {
        const at = toCanvas(part.centre);
        const swapped = part.rotation === 90 || part.rotation === 270;
        const width = swapped ? part.def.size.height : part.def.size.width;
        const height = swapped ? part.def.size.width : part.def.size.height;
        const result: DiagramPart = { type: part.def.type, id: part.id, top: Math.round(at.y - height / 2), left: Math.round(at.x - width / 2), attrs: part.attrs };
        if (part.rotation !== 0) result.rotate = part.rotation;
        return result;
    });
    const wired = new Set(connections.flatMap(([a, b]) => [a.split(":")[0], b.split(":")[0]]));
    const loose = placed.filter((p) => !wired.has(p.id)).map((p) => p.id);

    const diagram: Diagram = { version: DIAGRAM_VERSION, author: "holotrace", editor: "holotrace", parts: [...partList, ...parts], connections, dependencies: {} };
    return { diagram, report: { parts: partList.length, connections: connections.length, nodes: nodeCount, dangling, unassigned, loose, overlay } };
}

// ---- Reading a diagram in ----

const ROTATIONS: Rotation[] = [0, 90, 180, 270];

// Checks a diagram read from a file and tidies it: parts of an unknown type become generic parts, and anything that
// cannot be used (a broken connection, a duplicate id) is left out with a warning, so one bad entry does not lose the file.
export function parseDiagram(input: unknown): { diagram: Diagram; warnings: string[] } | { error: string } {
    if (typeof input !== "object" || input === null || Array.isArray(input)) return { error: "the file is not a diagram (expected a JSON object)" };
    const source = input as Record<string, unknown>;
    if (!Array.isArray(source.parts)) return { error: 'the file has no "parts" list' };
    const warnings: string[] = [];
    if (source.version !== DIAGRAM_VERSION) warnings.push(`version is ${JSON.stringify(source.version)}, not ${DIAGRAM_VERSION}; reading it as it is`);

    const parts: DiagramPart[] = [];
    const seen = new Set<string>();
    for (const [n, raw] of source.parts.entries()) {
        const part = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
        const id = typeof part.id === "string" ? part.id.trim() : "";
        if (id === "" || id.includes(":")) {
            warnings.push(`part ${n + 1} has no usable id (it must be text without ":"); left out`);
            continue;
        }
        if (seen.has(id)) {
            warnings.push(`part id ${id} appears twice; the second is left out`);
            continue;
        }
        if (!Number.isFinite(part.top) || !Number.isFinite(part.left)) {
            warnings.push(`part ${id} has no numeric top and left; left out`);
            continue;
        }
        const attrs = (typeof part.attrs === "object" && part.attrs !== null ? { ...(part.attrs as Record<string, string | number | boolean>) } : {}) as DiagramPart["attrs"];
        let type = typeof part.type === "string" ? part.type : "";
        if (!partByType(type)) {
            warnings.push(`part ${id} has an unknown type ${JSON.stringify(type)}; shown as a generic part`);
            attrs.label = attrs.label ?? type;
            type = GENERIC_TYPE;
        }
        const rotate = part.rotate === undefined ? 0 : (part.rotate as Rotation);
        if (!ROTATIONS.includes(rotate)) warnings.push(`part ${id} has rotate ${JSON.stringify(part.rotate)}; turning it 0`);
        seen.add(id);
        const result: DiagramPart = { type, id, top: part.top as number, left: part.left as number, attrs };
        if (ROTATIONS.includes(rotate) && rotate !== 0) result.rotate = rotate;
        parts.push(result);
    }

    const pinsById = new Map(parts.map((p) => [p.id, new Set(pinsOf(partByType(p.type)!, p.attrs).map((pin) => pin.id))]));
    const connections: DiagramConnection[] = [];
    for (const [n, raw] of (Array.isArray(source.connections) ? source.connections : []).entries()) {
        const list = Array.isArray(raw) ? raw : [];
        const [a, b, colour, hints] = list as [unknown, unknown, unknown, unknown];
        const ends = [a, b].map((e) => (typeof e === "string" ? e.split(":") : []));
        const bad = ends.find(([id, pin]) => !id || !pin || !pinsById.get(id)?.has(pin));
        if (bad !== undefined) {
            warnings.push(`connection ${n + 1} (${JSON.stringify(list.slice(0, 2))}) joins something that is not there; left out`);
            continue;
        }
        connections.push([a as string, b as string, typeof colour === "string" ? colour : "green", Array.isArray(hints) ? hints.filter((h): h is string => typeof h === "string") : []]);
    }

    return {
        diagram: {
            version: DIAGRAM_VERSION,
            author: typeof source.author === "string" ? source.author : "holotrace",
            editor: typeof source.editor === "string" ? source.editor : "holotrace",
            parts,
            connections,
            dependencies: typeof source.dependencies === "object" && source.dependencies !== null ? (source.dependencies as Record<string, unknown>) : {},
        },
        warnings,
    };
}
