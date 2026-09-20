// Converting between a diagram (the file format, see diagram.ts) and the editor's circuit. App only: it uses the
// editor's types, unlike the rest of this folder.
//
// A connection's routing hints hold the corners the user pulled the wire through, as absolute canvas points written
// "x,y". Empty hints mean the editor routes the wire itself.

import { COMPONENT_DISPLAY_NAME, defaultPins } from '../componentLibrary';
import { createId } from '../id';
import type { CircuitComponent, CircuitState, ComponentType, Wire, WireEnd, WireNode } from '../types';
import { DIAGRAM_VERSION, type Diagram, type DiagramConnection, type DiagramPart, type Rotation } from './diagram';
import { NODE_TYPE, partByType } from './parts';

const PREFIX = 'holotrace-';
const COLOURS: Record<string, string> = { green: '#22c55e', red: '#dc2626', black: '#111827' };

const isType = (type: string): type is ComponentType => type.startsWith(PREFIX) && type !== NODE_TYPE && partByType(type) !== undefined;

const colourFor = (name: string) => COLOURS[name] ?? (/^#[0-9a-f]{3,8}$/i.test(name) ? name : COLOURS.green);
const nameFor = (colour: string) => Object.entries(COLOURS).find(([, hex]) => hex.toLowerCase() === colour.toLowerCase())?.[0] ?? colour;

// A part's box, turned a quarter: width and height swap.
function boxOf(type: string, rotation: number) {
	const size = partByType(type)?.size ?? { width: 0, height: 0 };
	return rotation === 90 || rotation === 270 ? { width: size.height, height: size.width } : size;
}

/** The circuit a diagram describes. Ids of parts and junctions are kept as the diagram's own names (`R1`, `n1`). */
export function diagramToCircuit(diagram: Diagram): Pick<CircuitState, 'components' | 'wires' | 'nodes'> {
	const components: CircuitComponent[] = [];
	const nodes: WireNode[] = [];
	const componentIds = new Map<string, string>();

	for (const part of diagram.parts) {
		if (part.type === NODE_TYPE) {
			nodes.push({ id: part.id, x: part.left, y: part.top });
			continue;
		}
		if (!isType(part.type)) continue;
		const type = part.type.slice(PREFIX.length) as ComponentType;
		const rotation = (part.rotate ?? 0) as Rotation;
		const box = boxOf(part.type, rotation);
		const id = createId();
		componentIds.set(part.id, id);
		const pins = Number(part.attrs.pins);
		components.push({
			id,
			refId: part.id,
			type,
			label: type === 'generic' ? String(part.attrs.label ?? COMPONENT_DISPLAY_NAME.generic) : COMPONENT_DISPLAY_NAME[type],
			x: part.left + box.width / 2,
			y: part.top + box.height / 2,
			rotation,
			mirrored: part.attrs.mirror === true,
			value: part.attrs.value === undefined ? undefined : String(part.attrs.value),
			color: part.attrs.color === undefined ? undefined : String(part.attrs.color),
			pins: defaultPins(type, Number.isFinite(pins) ? pins : undefined)
		});
	}

	const endOf = (endpoint: string): WireEnd | null => {
		const [partId, pinId] = endpoint.split(':');
		if (nodes.some((n) => n.id === partId)) return { nodeId: partId };
		const componentId = componentIds.get(partId);
		return componentId ? { componentId, pinId } : null;
	};
	const wires: Wire[] = [];
	for (const [a, b, colour, hints] of diagram.connections) {
		const from = endOf(a);
		const to = endOf(b);
		if (!from || !to) continue;
		const waypoints = hints
			.map((hint) => hint.split(',').map(Number))
			.filter((p) => p.length === 2 && p.every(Number.isFinite))
			.map(([x, y]) => ({ x, y }));
		wires.push({ id: createId(), from, to, color: colourFor(colour), style: 'solid', ...(waypoints.length ? { waypoints } : {}) });
	}
	return { components, wires, nodes };
}

/** The diagram of a circuit, ready to save. Part ids are made unique, so a reference typed twice still exports. */
export function circuitToDiagram(state: Pick<CircuitState, 'components' | 'wires' | 'nodes'>): Diagram {
	const used = new Set<string>();
	const unique = (wanted: string) => {
		let id = wanted.trim().replace(/:/g, '-') || 'X';
		for (let n = 2; used.has(id); n++) id = `${wanted}_${n}`;
		used.add(id);
		return id;
	};
	const idOf = new Map<string, string>();

	const parts: DiagramPart[] = state.components.map((c) => {
		const id = unique(c.refId);
		idOf.set(c.id, id);
		const box = boxOf(`${PREFIX}${c.type}`, c.rotation);
		const attrs: DiagramPart['attrs'] = {};
		if (c.value !== undefined) attrs.value = c.value;
		if (c.color !== undefined) attrs.color = c.color;
		if (c.type === 'generic') {
			attrs.label = c.label;
			if (c.pins.length > 2) attrs.pins = c.pins.length;
		}
		if (c.mirrored) attrs.mirror = true;
		const part: DiagramPart = { type: `${PREFIX}${c.type}`, id, top: Math.round(c.y - box.height / 2), left: Math.round(c.x - box.width / 2), attrs };
		if (c.rotation !== 0) part.rotate = c.rotation;
		return part;
	});
	for (const [n, node] of state.nodes.entries()) {
		const id = unique(`n${n + 1}`);
		idOf.set(node.id, id);
		parts.push({ type: NODE_TYPE, id, top: Math.round(node.y), left: Math.round(node.x), attrs: {} });
	}

	const endpoint = (end: WireEnd): string | null => {
		if ('nodeId' in end) return idOf.has(end.nodeId) ? `${idOf.get(end.nodeId)}:n` : null;
		return idOf.has(end.componentId) ? `${idOf.get(end.componentId)}:${end.pinId}` : null;
	};
	const connections: DiagramConnection[] = [];
	for (const wire of state.wires) {
		const a = endpoint(wire.from);
		const b = endpoint(wire.to);
		if (a === null || b === null) continue;
		connections.push([a, b, nameFor(wire.color), (wire.waypoints ?? []).map((p) => `${Math.round(p.x)},${Math.round(p.y)}`)]);
	}
	return { version: DIAGRAM_VERSION, author: 'holotrace', editor: 'holotrace', parts, connections, dependencies: {} };
}
