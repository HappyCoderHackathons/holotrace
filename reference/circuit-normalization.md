# Circuit normalization

## Status

The first server-side normalizer lives in `api_server/src/circuit/`. Its contracts are versioned as
`opencv-analysis-v0`, `recognition-v0`, and `circuit-ir-v0`. They are provisional while the OpenCV capture pipeline
and correction UI are being integrated.

The normalizer does not call a simulator. The API server combines image geometry with classifier evidence to produce
a canonical electrical graph. The user-facing app consumes Circuit IR and source layout rather than rebuilding
electrical connectivity from rendering objects.

## Inputs

### OpenCV analysis

OpenCV provides:

- dimensions of the exact clean image submitted to recognition;
- one region and source-image bounding box per proposed symbol;
- optional clockwise component rotation in degrees;
- a topological wire graph containing nodes and polyline segments.

Every wire segment references two node IDs. Connected segments must share node IDs. An unconnected visual crossing
must be represented by separate nodes, even when those nodes have the same image coordinates. This prevents the
normalizer from inventing a junction at a crossover.

The graph should contain endpoints where wires enter component regions. It may also contain bend nodes for source
layout fidelity. Region IDs must match those sent to the classifier.

### Recognition result

The existing `recognition-v0` result supplies a label, confidence, and alternatives for each region. The normalizer
joins recognition to OpenCV regions by region ID. Background, text, junction, and crossover predictions do not
become component instances.

## Normalization

For each recognized component, a pin template describes named logical pins at normalized positions around the symbol
box. The normalizer rotates those positions with the OpenCV orientation and snaps each pin to the closest wire node
within a configurable distance.

Wire segments are grouped into connected sets. Every set touched by a component pin becomes a canonical net. A net
contains component-and-pin members rather than screen coordinates or pairwise edges.

The normalizer refuses to guess when equally close nodes belong to different wire networks. It emits a review issue
instead. It also reports low-confidence components, unsupported component templates, unconnected pins, invalid wire
segments, and a missing ground/reference.

## Outputs

`NormalizationResult` contains three separate representations:

- `circuit`: canonical `circuit-ir-v0` components, logical pins, and nets;
- `sourceLayout`: source-image placements, pin anchors, and wire polylines for review;
- `issues`: structured problems for the correction workflow.

Source coordinates are not the authority for connectivity. The canonical nets are. A correction updates the circuit
and source layout deliberately rather than relying on a renderer's edge objects.

## Simulator adapters

`SimulationAdapter` defines the server boundary for CircuitJS, ngspice, Wokwi, or a digital event engine. Each
adapter must:

1. report whether every required component and property is supported;
2. export an engine-specific project from Circuit IR;
3. translate engine state back into normalized values for the shared views.

Adapters are intentionally not part of this first normalization slice. The correction workflow and component values
must exist before generated simulator files can be treated as electrically meaningful.

## Current limitations

- Pin templates cover the initial passive, source, transistor, op-amp, terminal, and logic-gate classes.
- Multi-unit ICs, transformers, relays, optocouplers, and other complex parts still need explicit pin templates.
- Component values and text require OCR or user entry.
- OpenCV remains responsible for emitting wire topology and orientation.
- A recognized circuit is not simulatable until blocking review issues are resolved.
