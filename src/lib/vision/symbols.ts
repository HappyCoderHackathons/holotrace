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

// The groups are the section headings of the rapidtables page, in snake case. A component is named
// with its group when only the group can be told, and with its own name (from that group's table)
// when the symbol itself can.
export type Group =
    | "wire"
    | "switch_relay"
    | "ground"
    | "resistor"
    | "capacitor"
    | "inductor"
    | "power_supply"
    | "meter"
    | "lamp"
    | "diode_led"
    | "transistor"
    | "miscellaneous"
    | "antenna"
    | "logic_gate";

export type SymbolDrawing = {
    group: Group;
    // The symbol's own name, the JSON's local_label when it matches well.
    label: string;
    // How big the symbol's body is, at the longest, in pen-stroke widths. A match outside this range
    // counts for less: a small loop is a switch's curl, a big one a gate.
    strokes?: [min: number, max: number];
    // Symbols that other things (a gate, a ring, a scribble) are easily mistaken for only count when
    // they match at least this well; below it they are ignored, not just outvoted.
    minConfidence?: number;
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

// An arrow head at (x, y) pointing along (dx, dy).
const head = (x: number, y: number, dx: number, dy: number): Prim[] => {
    const n = Math.hypot(dx, dy);
    const [ux, uy] = [dx / n, dy / n];
    return [line(x, y, x - 0.1 * ux + 0.06 * uy, y - 0.1 * uy - 0.06 * ux), line(x, y, x - 0.1 * ux - 0.06 * uy, y - 0.1 * uy + 0.06 * ux)];
};
const arrow = (x0: number, y0: number, x1: number, y1: number): Prim[] => [line(x0, y0, x1, y1), ...head(x1, y1, x1 - x0, y1 - y0)];
const coil = (): Prim[] => [
    line(0, 0.6, 0.12, 0.6),
    arc(0.22, 0.6, 0.1, 0.25, 180, 360),
    arc(0.42, 0.6, 0.1, 0.25, 180, 360),
    arc(0.62, 0.6, 0.1, 0.25, 180, 360),
    arc(0.82, 0.6, 0.1, 0.25, 180, 360),
    line(0.92, 0.6, 1, 0.6),
];
const rectResistor = (): Prim[] => [...rect(0.2, 0.3, 0.8, 0.7), ...leads(0.2, 0.8)];
const npn = (arrowOut: boolean): Prim[] => [
    line(0, 0.5, 0.4, 0.5),
    line(0.4, 0.25, 0.4, 0.75),
    line(0.4, 0.4, 0.75, 0.15),
    line(0.75, 0.15, 0.75, 0),
    line(0.4, 0.6, 0.75, 0.85),
    line(0.75, 0.85, 0.75, 1),
    ...(arrowOut ? head(0.75, 0.85, 0.35, 0.25) : head(0.4, 0.6, -0.35, -0.25)),
];
const source = (inside: Prim[]): Prim[] => [circle(0.5, 0.5, 0.3), ...inside, ...leads(0.2, 0.8)];

// Sketched switches and terminals are small: a loop with a tail, or a ring on a wire with an arm
// (whose box also takes in the wire and the arm, so it is bigger).
const CURL: [number, number] = [3, 9];
const SWITCH_BOX: [number, number] = [12, 25];
const BODY: [number, number] = [8, 35];
// Only a very close match counts for the symbols that are easily mistaken for something else.
const STRICT = { minConfidence: 0.75 };
const GATE = { group: "logic_gate", strokes: BODY } as const;

export const SYMBOLS: SymbolDrawing[] = [
    // Resistor symbols
    { group: "resistor", label: "resistor_ieee", parts: zigzag() },
    { group: "resistor", label: "resistor_iec", parts: rectResistor() },
    { group: "resistor", label: "potentiometer_ieee", ...STRICT, parts: [...zigzag(), ...arrow(0.5, 0, 0.5, 0.45)] },
    { group: "resistor", label: "potentiometer_iec", ...STRICT, parts: [...rectResistor(), ...arrow(0.5, 0, 0.5, 0.3)] },
    { group: "resistor", label: "variable_resistor_ieee", ...STRICT, parts: [...zigzag(), ...arrow(0.15, 0.95, 0.85, 0.05)] },
    { group: "resistor", label: "variable_resistor_iec", ...STRICT, parts: [...rectResistor(), ...arrow(0.15, 0.95, 0.85, 0.05)] },

    // Capacitor symbols
    { group: "capacitor", label: "capacitor", parts: [line(0.42, 0.15, 0.42, 0.85), line(0.58, 0.15, 0.58, 0.85), ...leads(0.42, 0.58)] },
    { group: "capacitor", label: "polarized_capacitor", parts: [line(0.4, 0.15, 0.4, 0.85), arc(0.75, 0.5, 0.17, 0.35, 120, 240), line(0.25, 0.2, 0.35, 0.2), line(0.3, 0.15, 0.3, 0.25), ...leads(0.4, 0.58)] },

    // Inductor symbols
    { group: "inductor", label: "inductor", parts: coil() },
    { group: "inductor", label: "iron_core_inductor", parts: [...coil(), line(0.1, 0.2, 0.95, 0.2), line(0.1, 0.27, 0.95, 0.27)] },

    // Power supply symbols. A sketched battery is often a filled block, or two or more plates.
    { group: "power_supply", label: "battery", parts: block(0.1, 0.35, 0.9, 0.65) },
    { group: "power_supply", label: "battery", parts: block(0.1, 0.2, 0.9, 0.8) },
    { group: "power_supply", label: "battery_cell", parts: [line(0.4, 0.15, 0.4, 0.85), line(0.6, 0.3, 0.6, 0.7), ...leads(0.4, 0.6)] },
    {
        group: "power_supply",
        label: "battery",
        parts: [line(0.3, 0.15, 0.3, 0.85), line(0.42, 0.3, 0.42, 0.7), line(0.56, 0.15, 0.56, 0.85), line(0.68, 0.3, 0.68, 0.7), ...leads(0.3, 0.68)],
    },
    { group: "power_supply", label: "voltage_source", ...STRICT, strokes: BODY, parts: source([line(0.36, 0.5, 0.5, 0.5), line(0.55, 0.5, 0.67, 0.5), line(0.61, 0.44, 0.61, 0.56)]) },
    { group: "power_supply", label: "current_source", ...STRICT, strokes: BODY, parts: source([line(0.33, 0.5, 0.67, 0.5), ...head(0.67, 0.5, 1, 0)]) },
    { group: "power_supply", label: "ac_voltage_source", ...STRICT, strokes: BODY, parts: source([arc(0.4, 0.5, 0.1, 0.12, 180, 360), arc(0.6, 0.5, 0.1, 0.12, 0, 180)]) },

    // Switch symbols: the textbook one, and the ways a switch is sketched
    { group: "switch_relay", label: "spst_switch", parts: [line(0, 0.65, 0.25, 0.65), circle(0.25, 0.65, 0.03), ...path([0.25, 0.65], [0.72, 0.25]), circle(0.78, 0.65, 0.03), line(0.78, 0.65, 1, 0.65)] },
    { group: "switch_relay", label: "spst_switch", strokes: CURL, parts: [circle(0.35, 0.55, 0.28), line(0.6, 0.42, 1, 0.15)] },
    { group: "switch_relay", label: "spst_switch", strokes: CURL, parts: [arc(0.4, 0.55, 0.3, 0.3, 100, 420), line(0.7, 0.5, 1, 0.3)] },
    { group: "switch_relay", label: "spst_switch", strokes: SWITCH_BOX, parts: [line(0, 0.35, 1, 0.35), circle(0.55, 0.35, 0.14), line(0.47, 0.45, 0.12, 0.9)] },
    { group: "switch_relay", label: "spdt_switch", parts: [line(0, 0.5, 0.2, 0.5), circle(0.2, 0.5, 0.03), ...path([0.2, 0.5], [0.7, 0.25]), circle(0.78, 0.25, 0.03), line(0.78, 0.25, 1, 0.25), circle(0.78, 0.75, 0.03), line(0.78, 0.75, 1, 0.75)] },
    { group: "switch_relay", label: "pushbutton_switch", parts: [line(0, 0.7, 0.3, 0.7), line(0.7, 0.7, 1, 0.7), line(0.25, 0.45, 0.75, 0.45), line(0.5, 0.45, 0.5, 0.2), line(0.35, 0.2, 0.65, 0.2)] },

    // Ground symbols
    { group: "ground", label: "earth_ground", ...STRICT, parts: [line(0.5, 0, 0.5, 0.45), line(0.15, 0.45, 0.85, 0.45), line(0.3, 0.65, 0.7, 0.65), line(0.42, 0.85, 0.58, 0.85)] },
    { group: "ground", label: "chassis_ground", ...STRICT, parts: [line(0.5, 0, 0.5, 0.4), line(0.2, 0.4, 0.8, 0.4), line(0.3, 0.4, 0.2, 0.75), line(0.5, 0.4, 0.4, 0.75), line(0.7, 0.4, 0.6, 0.75)] },
    { group: "ground", label: "digital_ground", ...STRICT, parts: [line(0.5, 0, 0.5, 0.4), ...closed([0.2, 0.4], [0.8, 0.4], [0.5, 0.85])] },

    // Wire symbols: the open end of a wire, a bare ring
    { group: "wire", label: "terminal", strokes: CURL, parts: [circle(0.75, 0.5, 0.2), line(0, 0.5, 0.55, 0.5)] },

    // Lamp symbols
    { group: "lamp", label: "lamp", strokes: BODY, parts: source([line(0.29, 0.29, 0.71, 0.71), line(0.29, 0.71, 0.71, 0.29)]) },

    // Diode and LED symbols
    { group: "diode_led", label: "diode", parts: diode() },
    { group: "diode_led", label: "zener_diode", parts: [...closed([0.25, 0.2], [0.25, 0.8], [0.7, 0.5]), ...path([0.8, 0.8], [0.7, 0.8], [0.7, 0.2], [0.6, 0.2]), ...leads(0.25, 0.7)] },
    { group: "diode_led", label: "led", parts: [...diode(), ...arrow(0.45, 0.2, 0.62, 0.02), ...arrow(0.6, 0.25, 0.77, 0.07)] },

    // Transistor symbols (the direction of the arrow is what tells NPN from PNP)
    { group: "transistor", label: "npn_transistor", ...STRICT, parts: npn(true) },
    { group: "transistor", label: "pnp_transistor", ...STRICT, parts: npn(false) },

    // Miscellaneous symbols
    { group: "miscellaneous", label: "fuse", parts: [...rect(0.2, 0.35, 0.8, 0.65), line(0.2, 0.5, 0.8, 0.5), ...leads(0.2, 0.8)] },
    { group: "miscellaneous", label: "op_amp", strokes: BODY, parts: [...closed([0.2, 0.1], [0.2, 0.9], [0.85, 0.5]), line(0, 0.3, 0.2, 0.3), line(0, 0.7, 0.2, 0.7), line(0.85, 0.5, 1, 0.5), line(0.26, 0.3, 0.36, 0.3), line(0.26, 0.7, 0.36, 0.7), line(0.31, 0.65, 0.31, 0.75)] },
    { group: "miscellaneous", label: "transformer", ...STRICT, parts: [line(0.47, 0.1, 0.47, 0.9), line(0.53, 0.1, 0.53, 0.9), arc(0.3, 0.25, 0.12, 0.1, -90, 90), arc(0.3, 0.45, 0.12, 0.1, -90, 90), arc(0.3, 0.65, 0.12, 0.1, -90, 90), arc(0.7, 0.25, 0.12, 0.1, 90, 270), arc(0.7, 0.45, 0.12, 0.1, 90, 270), arc(0.7, 0.65, 0.12, 0.1, 90, 270)] },

    // Antenna symbols
    { group: "antenna", label: "antenna", ...STRICT, parts: [line(0.5, 1, 0.5, 0.4), line(0.5, 0.4, 0.2, 0.05), line(0.5, 0.4, 0.8, 0.05)] },

    // Logic gate symbols
    { ...GATE, label: "not_gate", parts: [...closed([0.2, 0.2], [0.2, 0.8], [0.65, 0.5]), circle(0.7, 0.5, 0.05), ...leads(0.2, 0.75)] },
    { ...GATE, label: "and_gate", parts: andBody(0.85) },
    { ...GATE, label: "nand_gate", parts: [...andBody(0.93), circle(0.89, 0.5, 0.04)] },
    { ...GATE, label: "or_gate", parts: orBody(0.87) },
    { ...GATE, label: "nor_gate", parts: [...orBody(0.95), circle(0.91, 0.5, 0.04)] },
    { ...GATE, label: "xor_gate", parts: [...orBody(0.87), ...path([0.17, 0.15], [0.25, 0.3], [0.28, 0.5], [0.25, 0.7], [0.17, 0.85])] },
    { ...GATE, label: "xnor_gate", parts: [...orBody(0.95), circle(0.91, 0.5, 0.04), ...path([0.17, 0.15], [0.25, 0.3], [0.28, 0.5], [0.25, 0.7], [0.17, 0.85])] },
];

// Whether a part reaches the edge of the unit square, which makes it a lead.
export const isLead = (part: Prim): boolean => {
    const edge = (v: number) => v <= 0.001 || v >= 0.999;
    return part.kind === "line" && (edge(part.x0) || edge(part.x1) || edge(part.y0) || edge(part.y1));
};
