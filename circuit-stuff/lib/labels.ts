// Label questions the report asks. The mapping between this stage's names and the classifier's labels is
// src/lib/vision/labels.ts; what the API server would do with a label is asked of its own pin templates.

import { getPinTemplate, isComponentLabel } from "../../api_server/src/circuit/pin-templates";

export { agrees, unmappedNames } from "../../src/lib/vision/labels";

// What the API server's normalizer would do with a label the classifier returned: it drops text, junctions
// and crossovers, and builds a component with pins from the rest when it has a pin template for the label.
export function downstreamUse(label: string): string {
    if (!isComponentLabel(label)) return "not a component";
    const pins = getPinTemplate(label);
    return pins === undefined ? "no pin template yet" : `${pins.length} pin${pins.length === 1 ? "" : "s"}`;
}
