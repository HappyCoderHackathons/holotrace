// Reference drawings of common electrical symbols (after https://www.rapidtables.com/electric/electrical_symbols.html),
// as simple line art, for matching against the components found in a hand-drawn circuit.
//
// Each symbol is drawn once, in one orientation, inside the unit square (x right, y down). The
// matcher crops the drawing to its ink and tries it rotated and mirrored, so the drawings need not
// cover every orientation. It also tries each without its leads (the lines reaching the edge of the
// square), since a box found in a sketch often hugs the body alone.

type Prim =
    | { kind: "line"; x0: number; y0: number; x1: number; y1: number }
    | { kind: "circle"; x: number; y: number; r: number }
    // Part of an ellipse, angles in degrees clockwise from the +x axis.
    | { kind: "arc"; x: number; y: number; rx: number; ry: number; from: number; to: number };

export type SymbolDrawing = {
    // What goes in the JSON's local_label.
    label: string;
    // A coarser name to report when the match is only a rough one (all gates are a "logic_gate").
    // Defaults to the label.
    family?: string;
    // How big the symbol's body is, at the longest, in pen-stroke widths. A match outside this range
    // counts for less: a small loop is a switch's curl, a big one a gate.
    strokes?: [min: number, max: number];
    parts: Prim[];
};

const line = (x0: number, y0: number, x1: number, y1: number): Prim => ({ kind: "line", x0, y0, x1, y1 });
const circle = (x: number, y: number, r: number): Prim => ({ kind: "circle", x, y, r });
const arc = (x: number, y: number, rx: number, ry: number, from: number, to: number): Prim => ({ kind: "arc", x, y, rx, ry, from, to });
// Joined straight segments through the points.
const path = (...pts: [number, number][]): Prim[] => pts.slice(1).map((p, n) => line(pts[n][0], pts[n][1], p[0], p[1]));
const closed = (...pts: [number, number][]): Prim[] => path(...pts, pts[0]);
const rect = (x0: number, y0: number, x1: number, y1: number): Prim[] => closed([x0, y0], [x1, y0], [x1, y1], [x0, y1]);

// Horizontal leads on the middle line, from the edges to x0 and from x1 to the edge.
const leads = (x0: number, x1: number, y = 0.5): Prim[] => [line(0, y, x0, y), line(x1, y, 1, y)];

// The body of an AND gate (flat back, round front) between x = 0.3 and 0.85, with its input leads.
const andBody = (outX: number): Prim[] => [
    line(0.3, 0.15, 0.3, 0.85),
    line(0.3, 0.15, 0.55, 0.15),
    line(0.3, 0.85, 0.55, 0.85),
    arc(0.55, 0.5, 0.3, 0.35, -90, 90),
    line(0, 0.35, 0.3, 0.35),
    line(0, 0.65, 0.3, 0.65),
    line(outX, 0.5, 1, 0.5),
];

// The body of an OR gate (curved back, pointed front) with its input leads.
const orBody = (outX: number): Prim[] => [
    ...path([0.25, 0.15], [0.33, 0.3], [0.36, 0.5], [0.33, 0.7], [0.25, 0.85]),
    ...path([0.25, 0.15], [0.45, 0.17], [0.65, 0.28], [0.8, 0.42], [0.87, 0.5], [0.8, 0.58], [0.65, 0.72], [0.45, 0.83], [0.25, 0.85]),
    line(0, 0.35, 0.34, 0.35),
    line(0, 0.65, 0.34, 0.65),
    line(outX, 0.5, 1, 0.5),
];

const zigzag = (): Prim[] => [
    ...path([0, 0.5], [0.15, 0.5], [0.22, 0.2], [0.34, 0.8], [0.46, 0.2], [0.58, 0.8], [0.7, 0.2], [0.78, 0.5], [1, 0.5]),
];

// A filled block, the way a sketched battery often looks: closely spaced strokes across a box.
const block = (x0: number, y0: number, x1: number, y1: number): Prim[] =>
    Array.from({ length: 9 }, (_, n) => line(x0, y0 + ((y1 - y0) * n) / 8, x1, y0 + ((y1 - y0) * n) / 8));

const diode = (): Prim[] => [...closed([0.25, 0.2], [0.25, 0.8], [0.7, 0.5]), line(0.7, 0.2, 0.7, 0.8), ...leads(0.25, 0.7)];

// Sketched switches are a small loop with a tail; gates, lamps and sources are bigger than that.
const CURL: [number, number] = [3, 9];
const BODY: [number, number] = [8, 35];
const GATE = { family: "logic_gate", strokes: BODY };

export const SYMBOLS: SymbolDrawing[] = [
    { label: "resistor", parts: zigzag() },
    { label: "resistor", parts: [...rect(0.2, 0.3, 0.8, 0.7), ...leads(0.2, 0.8)] },
    { label: "battery", parts: block(0.1, 0.35, 0.9, 0.65) },
    { label: "battery", parts: block(0.1, 0.2, 0.9, 0.8) },
    { label: "capacitor", parts: [line(0.42, 0.15, 0.42, 0.85), line(0.58, 0.15, 0.58, 0.85), ...leads(0.42, 0.58)] },
    { label: "battery", parts: [line(0.4, 0.15, 0.4, 0.85), line(0.6, 0.3, 0.6, 0.7), ...leads(0.4, 0.6)] },
    {
        label: "battery",
        parts: [line(0.3, 0.15, 0.3, 0.85), line(0.42, 0.3, 0.42, 0.7), line(0.56, 0.15, 0.56, 0.85), line(0.68, 0.3, 0.68, 0.7), ...leads(0.3, 0.68)],
    },
    {
        label: "lamp",
        strokes: BODY,
        parts: [circle(0.5, 0.5, 0.3), line(0.29, 0.29, 0.71, 0.71), line(0.29, 0.71, 0.71, 0.29), ...leads(0.2, 0.8)],
    },
    {
        label: "inductor",
        parts: [line(0, 0.6, 0.12, 0.6), arc(0.22, 0.6, 0.1, 0.25, 180, 360), arc(0.42, 0.6, 0.1, 0.25, 180, 360), arc(0.62, 0.6, 0.1, 0.25, 180, 360), arc(0.82, 0.6, 0.1, 0.25, 180, 360), line(0.92, 0.6, 1, 0.6)],
    },
    { label: "switch", parts: [line(0, 0.65, 0.25, 0.65), circle(0.25, 0.65, 0.03), ...path([0.25, 0.65], [0.72, 0.25]), circle(0.78, 0.65, 0.03), line(0.78, 0.65, 1, 0.65)] },
    // The loop with a tail that a sketched switch often is.
    { label: "switch", strokes: CURL, parts: [circle(0.35, 0.55, 0.28), line(0.6, 0.42, 1, 0.15)] },
    { label: "switch", strokes: CURL, parts: [arc(0.4, 0.55, 0.3, 0.3, 100, 420), line(0.7, 0.5, 1, 0.3)] },
    { label: "diode", parts: diode() },
    {
        label: "ground",
        parts: [line(0.5, 0, 0.5, 0.45), line(0.15, 0.45, 0.85, 0.45), line(0.3, 0.65, 0.7, 0.65), line(0.42, 0.85, 0.58, 0.85)],
    },
    { label: "fuse", parts: [...rect(0.2, 0.35, 0.8, 0.65), line(0.2, 0.5, 0.8, 0.5), ...leads(0.2, 0.8)] },
    { label: "not_gate", ...GATE, parts: [...closed([0.2, 0.2], [0.2, 0.8], [0.65, 0.5]), circle(0.7, 0.5, 0.05), ...leads(0.2, 0.75)] },
    { label: "and_gate", ...GATE, parts: andBody(0.85) },
    { label: "nand_gate", ...GATE, parts: [...andBody(0.93), circle(0.89, 0.5, 0.04)] },
    { label: "or_gate", ...GATE, parts: orBody(0.87) },
    { label: "nor_gate", ...GATE, parts: [...orBody(0.95), circle(0.91, 0.5, 0.04)] },
    { label: "xor_gate", ...GATE, parts: [...orBody(0.87), ...path([0.17, 0.15], [0.25, 0.3], [0.28, 0.5], [0.25, 0.7], [0.17, 0.85])] },
];

// Whether a part reaches the edge of the unit square, which makes it a lead.
export const isLead = (part: Prim): boolean => {
    const edge = (v: number) => v <= 0.001 || v >= 0.999;
    return part.kind === "line" && (edge(part.x0) || edge(part.x1) || edge(part.y0) || edge(part.y1));
};
