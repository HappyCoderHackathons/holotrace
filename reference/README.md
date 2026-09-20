# Holotrace architecture reference

This directory records the current architectural direction for Holotrace. It turns early product brainstorming into a shared starting point for implementation and future design discussions.

These documents describe intentions, not implemented behavior. Names, schemas, dependencies, and service boundaries remain subject to validation as the application is built.

## Documents

- [System pipeline](system-pipeline.md): how a photograph becomes a validated circuit.
- [Rendering and interaction](rendering-and-interaction.md): how the same circuit powers editable 2D and interactive 3D views.
- [Simulation](simulation.md): how user interaction affects a running electrical simulation.
- [PostgreSQL](postgresql.md): how PostgreSQL persists the component catalog, circuit versions, and selected simulation results.
- [Schema](schema.sql.md): an annotated SQL draft for the PostgreSQL model.
- [Circuit normalization](circuit-normalization.md): provisional OpenCV wire-graph, pin-template, and Circuit IR flow.
- [Model API example](model-api-example.md): multipart recognition request and the OpenCV-to-Tauri call path.
- [OpenCV first pass](../opencv/README.md): how to call the local pass, and the sweep and merge that keep the result from depending on it being complete.
- [circuit-stuff](../circuit-stuff/README.md): scripts that send photo + JSON pairs to the model API and show the result.

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
