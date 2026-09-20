// How the names this stage gives components relate to the classifier's labels (the cghd-v0 label set in
// classifier/src/holotrace_classifier/labels.py). Pure, no OpenCV.

import { SYMBOLS } from "./symbols";

// The classifier labels each of this stage's names can mean, first the most likely. A pattern ending in "*"
// stands for any label that starts with what comes before it.
const CLASSIFIER_LABELS: Record<string, string[]> = {
    resistor: ["resistor*"],
    resistor_ieee: ["resistor"],
    resistor_iec: ["resistor"],
    potentiometer_ieee: ["resistor.adjustable"],
    potentiometer_iec: ["resistor.adjustable"],
    variable_resistor_ieee: ["resistor.adjustable"],
    variable_resistor_iec: ["resistor.adjustable"],
    capacitor: ["capacitor.unpolarized", "capacitor.polarized"],
    polarized_capacitor: ["capacitor.polarized"],
    inductor: ["inductor", "transformer"],
    iron_core_inductor: ["inductor"],
    power_supply: ["voltage*"],
    battery: ["voltage.battery"],
    battery_cell: ["voltage.battery"],
    voltage_source: ["voltage.dc"],
    current_source: ["voltage*"],
    ac_voltage_source: ["voltage.ac"],
    switch_relay: ["switch", "relay"],
    spst_switch: ["switch"],
    spdt_switch: ["switch"],
    pushbutton_switch: ["switch"],
    ground: ["gnd", "vss"],
    earth_ground: ["gnd"],
    chassis_ground: ["gnd"],
    digital_ground: ["gnd", "vss"],
    wire: ["terminal", "junction", "crossover"],
    terminal: ["terminal"],
    lamp: ["lamp"],
    diode_led: ["diode*"],
    diode: ["diode"],
    zener_diode: ["diode.zener"],
    led: ["diode.light_emitting"],
    transistor: ["transistor*"],
    npn_transistor: ["transistor.bjt"],
    pnp_transistor: ["transistor.bjt"],
    miscellaneous: ["*"],
    fuse: ["fuse"],
    op_amp: ["operational_amplifier*"],
    transformer: ["transformer"],
    antenna: ["antenna"],
    logic_gate: ["and", "or", "not", "nand", "nor", "xor"],
    and_gate: ["and"],
    or_gate: ["or"],
    not_gate: ["not"],
    nand_gate: ["nand"],
    nor_gate: ["nor"],
    xor_gate: ["xor"],
    xnor_gate: ["xor"],
};

const fitsPattern = (pattern: string, label: string) => (pattern.endsWith("*") ? label.startsWith(pattern.slice(0, -1)) : label === pattern);

// Whether the model's label is one this stage's name can mean (null when it made no guess).
export function agrees(local: string | null, model: string): boolean | null {
    if (local === null) return null;
    return (CLASSIFIER_LABELS[local] ?? [local]).some((pattern) => fitsPattern(pattern, model));
}

// The names of this stage's symbols that have no classifier label above.
export function unmappedNames(): string[] {
    return [...new Set(SYMBOLS.flatMap((symbol) => [symbol.group, symbol.label]))].filter((name) => !(name in CLASSIFIER_LABELS));
}

// The one classifier label a symbol name stands for, or null when it names only a group ("logic_gate" could be
// any gate) or several labels equally.
export function toClassifierLabel(name: string): string | null {
    if (!SYMBOLS.some((symbol) => symbol.label === name)) return null;
    const first = CLASSIFIER_LABELS[name]?.[0];
    return first !== undefined && !first.endsWith("*") ? first : null;
}

// The names of this stage's symbols that stand for a classifier label, first the ones it names most directly (used to
// look up how a drawn component is turned; see orientation in classify.ts).
export function symbolsFor(classifierLabel: string): string[] {
    const names = SYMBOLS.map((symbol) => symbol.label).filter((label, n, all) => all.indexOf(label) === n);
    const direct = names.filter((name) => CLASSIFIER_LABELS[name]?.[0] === classifierLabel);
    const others = names.filter((name) => !direct.includes(name) && (CLASSIFIER_LABELS[name] ?? []).some((pattern) => fitsPattern(pattern, classifierLabel)));
    return [...direct, ...others];
}

// The classifier's labels for things that are not components: it says these for boxes that hold no symbol.
// The API server's normalizer drops the same ones (isComponentLabel in api_server/src/circuit/pin-templates.ts).
const NON_COMPONENT_LABELS = new Set(["background", "text", "junction", "crossover"]);

export const isComponentLabel = (label: string): boolean => !NON_COMPONENT_LABELS.has(label);
