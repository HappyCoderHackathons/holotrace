// From the final components and the ink to a diagram: which pins are wired together, how each part is turned, and
// the parts and connections that make. The one place this sequence is written, so the app and the scripts cannot
// drift apart.

import { buildDiagram, type BuildReport, type Diagram } from "../diagram/diagram";
import { partForLabel } from "../diagram/parts";
import { toRect } from "./boxes";
import { orientation } from "./classify";
import type { Mat } from "./cv";
import { symbolsFor } from "./labels";
import type { Component } from "./reconcile";
import { traceWires } from "./wires";

export type DiagramResult = { diagram: Diagram; report: BuildReport };

// `ink` is white where there is ink, the size of the image the components' boxes are in; `thickness` is the pen stroke
// width in pixels (see strokeThickness in components.ts).
export function diagramFromInk(components: Component[], ink: Mat, thickness: number): DiagramResult {
    const boxes = components.map((component) => toRect(component.box));
    const graph = traceWires(ink, boxes, thickness);
    const orientations = components.map((component, n) => (partForLabel(component.label).directional ? orientation(ink, boxes[n], symbolsFor(component.label)) : null));
    return buildDiagram({ components, orientations, graph });
}
