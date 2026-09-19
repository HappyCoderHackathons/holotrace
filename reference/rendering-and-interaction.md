# Rendering and interaction

## Shared source of truth

The 2D and 3D views should be projections of the same Circuit IR and live simulation state. Neither scene graph should become the authoritative circuit definition.

```text
                         +-> 2D schematic
Circuit IR + layout data +-> 2D physical wiring view
                         +-> 3D physical view

Simulation state --------+-> voltage, current, color, motion, and labels
User interaction --------+-> component state or circuit edit
```

## 2D schematic

The 2D schematic should be the initial review and correction surface. The current candidate stack is:

- Svelte Flow for selection, dragging, connections, pan, and zoom;
- custom SVG symbols, terminals, wires, junctions, and labels;
- ELK.js or a circuit-aware layout layer for initial placement and routing.

Svelte Flow's edge representation is a view concern. Multi-terminal nets must remain multi-terminal nets in Circuit IR and be converted into visible wire segments and junctions by the 2D renderer.

The schematic should allow users to correct component identities, values, pin connections, and ambiguous junctions before attempting simulation.

## 2D physical view

A top-down physical mode can present realistic component illustrations and colored wires. It uses the same component package and pin anchors as the 3D view but is less expensive to render and easier to inspect on small screens.

This view should not imply that the physical arrangement was present in the source schematic. It is a generated wiring layout unless the input explicitly describes a breadboard or physical layout.

## 3D physical view

The current candidate stack is Threlte on Three.js because it aligns with Svelte and supports interactive web-based 3D. Runtime component assets should use GLB where practical.

Each physical component variant should define:

- a stable catalog identifier;
- physical dimensions and orientation;
- named pin anchors in component-local coordinates;
- a GLB asset reference and asset version;
- optional animation or material targets;
- performance metadata or a lower-detail variant.

Repeated parts should reuse geometry and materials where possible. Mobile devices require explicit budgets for polygons, textures, draw calls, shadows, and post-processing.

## Interaction model

Interactions fall into two categories:

### Circuit editing

- adding, deleting, or replacing a component;
- reconnecting pins;
- changing a component value or physical package;
- moving a component or rerouting a visible wire.

These actions create edits to the circuit or layout and should participate in versioning and undo history.

### Simulation controls

- pressing or releasing a momentary button;
- toggling a switch;
- moving a potentiometer;
- changing a variable source or sensor input;
- starting, pausing, resetting, or stepping the simulation.

These actions change simulation state or parameters without silently rewriting the circuit definition. A control event goes to the simulation adapter, and returned electrical state updates every active view.

Examples include deriving LED brightness from current, wire color from voltage, motor speed from simulated state, and oscilloscope traces from selected signals.

## Asset separation

One logical component can have several representations:

```text
Logical component
|- schematic SVG
|- physical 2D asset
|- one or more physical packages
|  `- GLB model and pin anchors
`- one or more simulation-engine models
```

Large SVG, texture, and GLB assets belong in object storage or a CDN. The database should store identity, URLs or storage keys, hashes, licensing and provenance, versions, and relationships to catalog records.
