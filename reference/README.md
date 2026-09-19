# Holotrace architecture reference

This directory records the current architectural direction for Holotrace. It turns early product brainstorming into a shared starting point for implementation and future design discussions.

These documents describe intentions, not implemented behavior. Names, schemas, dependencies, and service boundaries remain subject to validation as the application is built.

## Documents

- [System pipeline](system-pipeline.md): how a photograph becomes a validated circuit.
- [Rendering and interaction](rendering-and-interaction.md): how the same circuit powers editable 2D and interactive 3D views.
- [Simulation](simulation.md): how user interaction affects a running electrical simulation.
- [Tiger Data](tiger-data.md): how PostgreSQL persists the component catalog, circuit versions, and selected simulation results.

## Current direction

Holotrace should maintain one renderer-independent circuit definition. Recognition, component resolution, physical layout, rendering, and simulation are separate stages that communicate through typed, versioned contracts.

The likely initial sequence is:

1. Recognize and normalize a circuit from an image.
2. Let the user review it in an editable 2D schematic.
3. Validate that the circuit contains enough information to simulate.
4. Run the appropriate simulation engine.
5. Drive both 2D and 3D presentation from the same circuit and simulation state.

## Open decisions

- The first supported component subset.
- Whether initial simulation runs locally, remotely, or through both modes.
- The precise Circuit IR schema and versioning strategy.
- The asset storage provider and delivery strategy.
- The commercial and licensing constraints of third-party simulation engines.
- The rules for turning schematic topology into a physical layout.
