// The parts a diagram can hold: one catalog that says what each part is called, where its pins are, and which
// classifier labels (cghd-v0) become it. Pure data, so the app, the scripts and the diagram code share it.
//
// Positions are in canvas units, as offsets from the part's centre when it is not turned or mirrored, with y
// pointing down. The pin ids of the seven parts the editor already had are the ones it already uses.

export interface PinDef {
    id: string;
    label: string;
    x: number;
    y: number;
}

export interface PartDef {
    // The diagram's `type`, e.g. "holotrace-resistor".
    type: string;
    name: string;
    // Reference designator prefix: R1, D1, BAT1 ...
    refPrefix: string;
    // Size of the part's box, not turned.
    size: { width: number; height: number };
    pins: PinDef[];
    // The classifier labels that become this part.
    labels: string[];
    // Attributes a new part starts with.
    attrs: Record<string, string>;
    // Whether it matters which way round the part is (a diode, a battery, a gate), so a drawn part's turn is looked up.
    directional: boolean;
}

const twoPins = (x = 24, first = "1", second = "2", labels: [string, string] = ["1", "2"]): PinDef[] => [
    { id: first, label: labels[0], x: -x, y: 0 },
    { id: second, label: labels[1], x, y: 0 },
];
const gatePins: PinDef[] = [
    { id: "a", label: "A", x: -28, y: -10 },
    { id: "b", label: "B", x: -28, y: 10 },
    { id: "y", label: "Y", x: 28, y: 0 },
];

export const NODE_TYPE = "holotrace-node";
export const GENERIC_TYPE = "holotrace-generic";

export const PARTS: PartDef[] = [
    { type: "holotrace-resistor", name: "Resistor", refPrefix: "R", size: { width: 64, height: 28 }, pins: twoPins(), labels: ["resistor"], attrs: { value: "220Ω" }, directional: false },
    { type: "holotrace-capacitor", name: "Capacitor", refPrefix: "C", size: { width: 64, height: 32 }, pins: twoPins(), labels: ["capacitor.unpolarized", "capacitor.polarized"], attrs: { value: "10µF" }, directional: false },
    { type: "holotrace-battery", name: "Battery", refPrefix: "BAT", size: { width: 64, height: 36 }, pins: twoPins(28, "pos", "neg", ["+", "−"]), labels: ["voltage.battery", "voltage.dc"], attrs: { value: "3V" }, directional: true },
    { type: "holotrace-led", name: "LED", refPrefix: "D", size: { width: 64, height: 36 }, pins: twoPins(24, "a", "k", ["A", "K"]), labels: ["diode.light_emitting"], attrs: { color: "#e11d2e" }, directional: true },
    { type: "holotrace-diode", name: "Diode", refPrefix: "D", size: { width: 64, height: 32 }, pins: twoPins(24, "a", "k", ["A", "K"]), labels: ["diode", "diode.zener", "diode.thyrector"], attrs: {}, directional: true },
    { type: "holotrace-lamp", name: "Lamp", refPrefix: "LA", size: { width: 56, height: 56 }, pins: twoPins(), labels: ["lamp"], attrs: {}, directional: false },
    { type: "holotrace-ac-source", name: "AC source", refPrefix: "V", size: { width: 56, height: 56 }, pins: twoPins(), labels: ["voltage.ac"], attrs: {}, directional: false },
    { type: "holotrace-switch", name: "Switch", refPrefix: "SW", size: { width: 64, height: 32 }, pins: twoPins(), labels: ["switch"], attrs: {}, directional: false },
    { type: "holotrace-pushbutton", name: "Pushbutton", refPrefix: "SW", size: { width: 64, height: 32 }, pins: twoPins(), labels: [], attrs: {}, directional: false },
    {
        type: "holotrace-potentiometer",
        name: "Potentiometer",
        refPrefix: "POT",
        size: { width: 64, height: 44 },
        pins: [
            { id: "1", label: "1", x: -24, y: 0 },
            { id: "2", label: "2", x: 0, y: -22 },
            { id: "3", label: "3", x: 24, y: 0 },
        ],
        labels: ["resistor.adjustable"],
        attrs: { value: "10kΩ" },
        directional: false,
    },
    { type: "holotrace-ground", name: "Ground", refPrefix: "GND", size: { width: 32, height: 36 }, pins: [{ id: "g", label: "GND", x: 0, y: -16 }], labels: ["gnd", "vss"], attrs: {}, directional: true },
    { type: "holotrace-terminal", name: "Terminal", refPrefix: "T", size: { width: 16, height: 16 }, pins: [{ id: "t", label: "T", x: 0, y: 0 }], labels: ["terminal"], attrs: {}, directional: false },
    { type: "holotrace-and", name: "AND gate", refPrefix: "U", size: { width: 64, height: 48 }, pins: gatePins, labels: ["and"], attrs: {}, directional: true },
    { type: "holotrace-or", name: "OR gate", refPrefix: "U", size: { width: 64, height: 48 }, pins: gatePins, labels: ["or"], attrs: {}, directional: true },
    { type: "holotrace-nand", name: "NAND gate", refPrefix: "U", size: { width: 64, height: 48 }, pins: gatePins, labels: ["nand"], attrs: {}, directional: true },
    { type: "holotrace-nor", name: "NOR gate", refPrefix: "U", size: { width: 64, height: 48 }, pins: gatePins, labels: ["nor"], attrs: {}, directional: true },
    { type: "holotrace-xor", name: "XOR gate", refPrefix: "U", size: { width: 64, height: 48 }, pins: gatePins, labels: ["xor"], attrs: {}, directional: true },
    {
        type: "holotrace-not",
        name: "NOT gate",
        refPrefix: "U",
        size: { width: 56, height: 40 },
        pins: [
            { id: "a", label: "A", x: -28, y: 0 },
            { id: "y", label: "Y", x: 28, y: 0 },
        ],
        labels: ["not"],
        attrs: {},
        directional: true,
    },
    // Whatever else is recognized: a labelled box, so nothing is dropped. Its pins depend on how many wires meet it.
    { type: GENERIC_TYPE, name: "Part", refPrefix: "X", size: { width: 64, height: 40 }, pins: twoPins(), labels: [], attrs: {}, directional: false },
    // A junction: where a wire is joined by others. It is a point, not a box.
    { type: NODE_TYPE, name: "Junction", refPrefix: "n", size: { width: 0, height: 0 }, pins: [{ id: "n", label: "", x: 0, y: 0 }], labels: [], attrs: {}, directional: false },
];

const byType = new Map(PARTS.map((part) => [part.type, part]));
const byLabel = new Map(PARTS.flatMap((part) => part.labels.map((label) => [label, part] as const)));

export const partByType = (type: string): PartDef | undefined => byType.get(type);

// The part a classifier label becomes: its own, or the generic labelled box.
export const partForLabel = (label: string): PartDef => byLabel.get(label) ?? byType.get(GENERIC_TYPE)!;

// Pins of a generic part with `count` pins: down the left side, then down the right.
export function genericPins(count: number): PinDef[] {
    const n = Math.max(2, Math.min(16, Math.round(count)));
    const left = Math.ceil(n / 2);
    const spread = (index: number, of: number) => (of === 1 ? 0 : -((of - 1) * 10) + index * 20);
    return Array.from({ length: n }, (_, k) => {
        const onLeft = k < left;
        const index = onLeft ? k : k - left;
        return { id: String(k + 1), label: String(k + 1), x: onLeft ? -32 : 32, y: spread(index, onLeft ? left : n - left) };
    });
}

// The pins of a part as placed: the catalog's, or the generic part's `pins` attribute.
export function pinsOf(def: PartDef, attrs: Record<string, unknown>): PinDef[] {
    if (def.type !== GENERIC_TYPE) return def.pins;
    const count = Number(attrs.pins);
    return Number.isFinite(count) && count > 2 ? genericPins(count) : def.pins;
}
