# System pipeline

## Goal

Holotrace turns a photograph of a hand-drawn circuit diagram into a circuit that can be reviewed, rendered, edited, and simulated. The output of recognition must describe electrical meaning rather than a particular user interface or rendering engine.

## Proposed pipeline

```text
Image capture or import
        |
On-device OpenCV preprocessing
        |
External PyTorch recognition
        |
Raw recognition result
        |
Normalization and catalog matching
        |
Canonical Circuit IR
        |
Validation and user correction
        |
  +-----+----------+
  |                |
Layout engines   Simulation adapters
  |                |
2D and 3D views  Live simulation state
```

The on-device pass should handle inexpensive operations such as cropping, perspective correction, contrast normalization, denoising, and other input preparation. The external ML service can perform the more expensive symbol, wire, junction, text, and relationship recognition.

## Raw recognition result

Raw output should retain evidence needed to explain or correct a prediction:

- source-image coordinates and bounding regions;
- detected symbols, wires, junctions, and text;
- component values inferred from text or markings;
- confidence per prediction;
- alternative candidates where useful;
- the ML model and preprocessing versions;
- unresolved crossings, connections, pins, or components.

Raw recognition output is not yet a valid circuit. It may be incomplete, contradictory, or ambiguous.

## Canonical Circuit IR

Circuit IR is the authoritative, renderer-independent description of a circuit. At minimum it should represent:

- circuit and schema versions;
- component instances and logical component types;
- component properties such as resistance or capacitance;
- named pins or terminals;
- nets containing any number of member pins;
- power sources and a reference or ground node;
- recognition provenance and confidence;
- unresolved issues and validation status.

A net is not merely a rendered line or a pair of nodes. One net may connect many component pins and may be drawn as multiple wire segments with junctions.

Circuit IR should not contain Three.js objects, Svelte components, simulator-specific source text, or display coordinates as its sole representation of connectivity. Layout data and simulator translations are derived representations.

## Component resolution

Recognition may identify a logical component without knowing its exact physical package. For example, a `10 kOhm` resistor symbol does not distinguish an axial resistor from an 0603 or 0805 surface-mount package.

Holotrace should therefore distinguish:

- logical component type and electrical value;
- selected physical package;
- schematic symbol;
- physical 2D asset;
- 3D asset;
- simulation model.

The system can choose a generic default while marking the package as inferred. The user should be able to select a more precise component without changing the circuit's electrical topology.

## Review and validation

The workflow should expose a progression such as:

```text
Recognized -> Needs review -> Electrically valid -> Simulatable
```

A circuit can be renderable without being simulatable. Missing values, ambiguous crossings, unknown pin orientation, absent ground, or an unspecified supply voltage should produce actionable review items instead of a low-level solver failure.

User corrections should create a new circuit version. Preserve the original recognition result for auditability and possible model improvement. Do not use private user content as training data without an explicit policy and consent mechanism.

## Recognition implementation

The first recognition models live in [`classifier/`](../classifier/README.md): a crop classifier for regions proposed by the local OpenCV pass, and a full-page Faster R-CNN detector. Both emit a raw `RecognitionResult` that keeps boxes in source-image coordinates, confidences, alternatives, and model and preprocessing versions, as described above. The request contract in `classifier/src/holotrace_classifier/contracts.py` is provisional until the client input reference is defined.
