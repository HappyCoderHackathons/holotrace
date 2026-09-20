# diagram

The final components of a circuit and how they are wired, in the shape of [Wokwi's `diagram.json`](https://docs.wokwi.com/diagram-format), with Holotrace's own part types and pins. Pure TypeScript with no OpenCV, so the app and the scripts share it.

```json
{
  "version": 1, "author": "holotrace", "editor": "holotrace",
  "parts": [
    { "type": "holotrace-battery", "id": "BAT1", "top": 300, "left": 200, "attrs": { "value": "3V" } },
    { "type": "holotrace-led", "id": "D1", "top": 96, "left": 388, "rotate": 90, "attrs": { "color": "#e11d2e" } },
    { "type": "holotrace-resistor", "id": "R1", "top": 210, "left": 388, "rotate": 90, "attrs": { "value": "220Ω" } },
    { "type": "holotrace-node", "id": "n1", "top": 260, "left": 300, "attrs": {} }
  ],
  "connections": [
    ["BAT1:pos", "n1:n", "green", []],
    ["n1:n", "D1:k", "green", []],
    ["n1:n", "R1:1", "green", []],
    ["D1:a", "R1:2", "black", []]
  ],
  "dependencies": {}
}
```

- A **part** has a `type`, an `id` (its reference designator, `n1`, `n2`, ... for junctions), `top` and `left` (the top-left of its box; the point for a junction), `rotate` (clockwise degrees, left out when 0) and `attrs` (`value`, `color`, `label` for a generic part, `mirror: true`, `pins` for a generic part with more than two).
- A **connection** joins two endpoints, each `"part:pin"`, with a colour and routing hints. Hints are empty for now: the editor routes the wire itself.
- A **junction node** is a tiny part (`holotrace-node`, one pin `n`), so a file is only parts and connections. A wire between two parts is one connection; a wire that joins three or more gets a node and one connection from each pin to it.
- Wiring is **topology**, "which connects to what". The lines are drawn and edited by the editor, not stored as truth.
- Units are **canvas units**, always. A diagram built from a photo is scaled so the median part is a normal size and the circuit is centred, so importing needs no scaling.

## Files

| File | Does |
| --- | --- |
| [`parts.ts`](parts.ts) | the part catalog: names, pins (canvas offsets), sizes, reference prefixes, defaults, and which classifier labels (`cghd-v0`) become each part; anything else becomes the generic labelled box |
| [`diagram.ts`](diagram.ts) | `buildDiagram` (components + traced wires -> diagram, plus a report and an overlay in photo pixels) and `parseDiagram` (reads and checks a file) |
| [`circuit.ts`](circuit.ts) | app only: `diagramToCircuit` and `circuitToDiagram`, between a diagram and the editor's circuit (parts, wires, junction nodes) |

`buildDiagram` takes the final components (from [`reconcile`](../vision/reconcile.ts)), how each is turned ([`orientation`](../vision/classify.ts), where known) and the wire graph from [`traceWires`](../vision/wires.ts). It names parts in reading order, sends each wire contact to the nearest free pin of its part (a pin is shared only when a part has fewer pins than wires), and makes a connection for every link between two pins or junctions. `parseDiagram` never loses a file over one bad entry: an unknown part type becomes a generic part, and a broken connection or duplicate id is left out, each with a warning.

**Routing hints.** A connection's fourth entry holds the corners a wire was pulled through in the editor, as absolute canvas points written `"x,y"`. Empty means the editor routes the wire itself. `circuit.ts` writes and reads them, so an edited route survives export and import.
