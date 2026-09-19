# Simulation

## Responsibility

A renderer shows circuit state; a simulation engine calculates it. Holotrace should place an adapter boundary between its Circuit IR and any simulator-specific representation.

```text
Circuit IR
    |
Simulation adapter
    |
Engine-specific netlist, diagram, or firmware project
    |
Simulation engine
    |
Normalized state and events
    |
2D and 3D views
```

The normalized output may contain time, node voltages, branch currents, digital pin states, component power, warnings, and component-specific state such as motor speed.

## Candidate engines

No single engine is expected to cover every circuit category equally well.

### ngspice

The leading candidate for conventional passive, analog, and mixed-signal circuits. It accepts netlists and supplies electrical quantities while allowing Holotrace to own the user interface. Integration details, platform builds, supported models, and mobile performance still need validation.

### Wokwi

A possible adapter for firmware-driven microcontroller circuits such as Arduino, ESP32, STM32, and RP2040 projects. It offers broad embedded-system simulation, but commercial terms, external-service dependency, supported parts, API behavior, and UI integration must be evaluated before adoption.

### CircuitJS

A possible prototype or educational simulation option for immediate browser interaction. Its GPL license, older GWT architecture, internal circuit format, and integration surface require review before using it as an embedded kernel or modified product component.

### Digital event simulation

A dedicated event-driven engine may eventually be appropriate for large pure-logic circuits. It should still implement the same Holotrace adapter contract.

## Component simulation definitions

A component catalog entry needs electrical behavior in addition to visual assets. Depending on the engine, it may identify:

- a built-in primitive and parameters;
- a SPICE subcircuit or model;
- a Wokwi part type or custom chip;
- supported interactions and their parameter mapping;
- observable outputs and their units;
- safe defaults and validity constraints.

Simulation models must be versioned. A saved circuit should continue to identify which model version produced a result.

## Runtime interaction

A typical interaction is:

```text
User presses a rendered switch
        |
UI emits a semantic control event
        |
Adapter changes the switch state
        |
Engine advances or recalculates
        |
Adapter returns normalized electrical state
        |
All views update
```

The simulation loop should not depend on a database round trip. Active state belongs in memory near the engine. Persistence happens at session boundaries or at a deliberately sampled rate.

## Validation before run

Rendering should tolerate partial recognition; simulation often cannot. Before enabling a run, validate at least:

- required component values and models;
- pin counts and legal connections;
- a ground or reference node when required;
- power sources and voltages;
- unresolved crossings or recognition conflicts;
- availability of an engine adapter for every required component;
- firmware and processor selection for microcontroller circuits.

Return domain-level errors that point the user to the affected component or net. Do not expose raw solver errors as the only explanation.

## Saved results

Persist simulation configuration, model versions, selected inputs, warnings, and a result summary. Save time-series signals only when the user requests them or the product needs them. Downsample high-frequency output before database ingestion and retain full waveform exports in object storage when appropriate.
