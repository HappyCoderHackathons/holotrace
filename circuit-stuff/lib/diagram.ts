// The diagram of a pair: its final components and how they are wired (see src/lib/diagram/diagram.ts).

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { toRect } from "../../src/lib/vision/boxes";
import { orientation } from "../../src/lib/vision/classify";
import { partForLabel } from "../../src/lib/diagram/parts";
import { buildDiagram, type BuildReport, type Diagram } from "../../src/lib/diagram/diagram";
import { symbolsFor } from "../../src/lib/vision/labels";
import type { Component } from "../../src/lib/vision/reconcile";
import { traceWires } from "../../src/lib/vision/wires";
import type { PairInk } from "./ink";

export type DiagramResult = { diagram: Diagram; report: BuildReport };

// Works out the wiring between the components from the image's ink, and builds the diagram.
export function makeDiagram(components: Component[], ink: PairInk): DiagramResult {
    const boxes = components.map((component) => toRect(component.box));
    const nets = traceWires(ink.ink, boxes, ink.thickness);
    const orientations = components.map((component, n) => (partForLabel(component.label).directional ? orientation(ink.ink, boxes[n], symbolsFor(component.label)) : null));
    return buildDiagram({ components, orientations, nets });
}

export async function saveDiagram(dir: string, name: string, diagram: Diagram): Promise<string> {
    await mkdir(dir, { recursive: true });
    const file = join(dir, `${name}.diagram.json`);
    await writeFile(file, JSON.stringify(diagram, null, 2));
    return file;
}

export function printDiagram(name: string, { report }: DiagramResult, file: string) {
    console.log(`\ndiagram for ${name}: ${report.parts} parts, ${report.connections} connections, ${report.nodes} junction nodes`);
    if (report.dangling.length > 0) console.log(`  wires that reach one part and stop: ${report.dangling.map((d) => `${d.part}:${d.pin}`).join(", ")}`);
    if (report.loose.length > 0) console.log(`  parts nothing is wired to: ${report.loose.join(", ")}`);
    if (report.unassigned > 0) console.log(`  ${report.unassigned} wire contacts had no free pin`);
    console.log(`  written to ${file}`);
}
