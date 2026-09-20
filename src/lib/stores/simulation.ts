import { derived, writable, get } from 'svelte/store';
import { circuit } from './circuit';
import { endKey } from '../geometry';
import type { CircuitComponent, SimulationState, Wire } from '../types';

export const simulationRunning = writable<boolean>(false);
/** Parts this simulator has no model for: they never pass current, so they cannot short a loop. */
const NO_MODEL = new Set(['and', 'or', 'nand', 'nor', 'xor', 'not', 'generic', 'ground', 'terminal', 'ac-source']);

export const switchStates = writable<Record<string, boolean>>({});

function parseOhms(value?: string): number {
	if (!value) return 0;
	const match = value.match(/([\d.]+)\s*(k|K)?/);
	if (!match) return 0;
	const n = parseFloat(match[1]);
	return match[2] ? n * 1000 : n;
}

function parseVolts(value?: string): number {
	if (!value) return 3;
	const match = value.match(/([\d.]+)/);
	return match ? parseFloat(match[1]) : 3;
}

/**
 * Simplified series-loop simulator: builds an adjacency graph from wires,
 * finds the loop(s) containing a battery, and computes current through
 * a lumped series resistance. This is a pragmatic approximation suited
 * to hand-drawn hobby circuits (single loop, LED+resistor+battery, switches).
 */
function computeSimulation(components: CircuitComponent[], wires: Wire[], switches: Record<string, boolean>): SimulationState {
	const result: SimulationState = { running: false, current: {}, nodeVoltage: {}, ledOn: {} };

	const battery = components.find((c) => c.type === 'battery');
	if (!battery) return result;

	// build adjacency: componentId+pinId -> connected componentId+pinId list
	type NodeKey = string;
	const key = (compId: string, pinId: string): NodeKey => `${compId}:${pinId}`;
	const adjacency = new Map<NodeKey, NodeKey[]>();
	const addEdge = (a: NodeKey, b: NodeKey) => {
		if (!adjacency.has(a)) adjacency.set(a, []);
		if (!adjacency.has(b)) adjacency.set(b, []);
		adjacency.get(a)!.push(b);
		adjacency.get(b)!.push(a);
	};

	for (const w of wires) {
		addEdge(endKey(w.from), endKey(w.to));
	}
	// internal component edges (pin-to-pin through the component itself),
	// except open switches (which block current) and the battery (a source,
	// not a pass-through — its pins must only connect via external wires,
	// otherwise BFS finds a trivial short-circuit path through the battery itself)
	for (const c of components) {
		if (c.type === 'battery' || NO_MODEL.has(c.type)) continue;
		const isOpenSwitch =
			(c.type === 'switch' || c.type === 'pushbutton') && !switches[c.id];
		if (isOpenSwitch) continue;
		for (let i = 0; i < c.pins.length; i++) {
			for (let j = i + 1; j < c.pins.length; j++) {
				addEdge(key(c.id, c.pins[i].id), key(c.id, c.pins[j].id));
			}
		}
	}

	// BFS from battery positive pin to negative pin to find the path (loop)
	const start = key(battery.id, 'pos');
	const end = key(battery.id, 'neg');
	const visited = new Set<NodeKey>([start]);
	const parent = new Map<NodeKey, NodeKey>();
	const queue: NodeKey[] = [start];
	let found = false;

	while (queue.length) {
		const curr = queue.shift()!;
		if (curr === end && curr !== start) {
			found = true;
			break;
		}
		for (const next of adjacency.get(curr) ?? []) {
			if (!visited.has(next)) {
				visited.add(next);
				parent.set(next, curr);
				queue.push(next);
			}
		}
	}

	if (!found) return result; // open circuit

	// reconstruct path of nodes
	const path: NodeKey[] = [end];
	let cursor = end;
	while (cursor !== start) {
		cursor = parent.get(cursor)!;
		path.unshift(cursor);
	}

	// determine which components/wires lie on the path
	const pathComponentIds = new Set<string>();
	const nodeSet = new Set(path);
	for (const nk of path) {
		const [compId] = nk.split(':');
		pathComponentIds.add(compId);
	}

	// sum series resistance and led forward voltage along path components
	let totalResistance = 0;
	let ledDrop = 0;
	const ledsOnPath: string[] = [];
	for (const c of components) {
		if (!pathComponentIds.has(c.id)) continue;
		if (c.type === 'resistor') totalResistance += parseOhms(c.value) || 220;
		if (c.type === 'potentiometer') totalResistance += (parseOhms(c.value) || 10000) / 2;
		if (c.type === 'led' || c.type === 'lamp') {
			ledDrop += 2; // typical red LED forward voltage
			ledsOnPath.push(c.id);
		}
	}

	const supplyVoltage = parseVolts(battery.value);
	const netVoltage = supplyVoltage - ledDrop;
	// avoid divide by zero; assume small wire resistance floor
	const resistance = Math.max(totalResistance, 1);
	const currentAmps = netVoltage > 0 ? netVoltage / resistance : 0;
	// normalize for visualization: clamp to [0, 1] where ~20mA is "full brightness"
	const normalized = Math.max(0, Math.min(1, currentAmps / 0.02));

	result.running = true;
	for (const led of ledsOnPath) {
		result.ledOn[led] = normalized > 0.02;
	}

	// mark wires along the path as carrying current
	for (const w of wires) {
		const a = endKey(w.from);
		const b = endKey(w.to);
		if (nodeSet.has(a) && nodeSet.has(b)) {
			result.current[w.id] = normalized;
		}
	}

	return result;
}

export const simulation = derived(
	[circuit, simulationRunning, switchStates],
	([$circuit, $running, $switches]) => {
		if (!$running) {
			return { running: false, current: {}, nodeVoltage: {}, ledOn: {} } as SimulationState;
		}
		return computeSimulation($circuit.components, $circuit.wires, $switches);
	}
);

export function startSimulation() {
	simulationRunning.set(true);
}

export function stopSimulation() {
	simulationRunning.set(false);
}

export function toggleSimulation() {
	simulationRunning.set(!get(simulationRunning));
}

export function toggleSwitch(componentId: string) {
	switchStates.update((s) => ({ ...s, [componentId]: !s[componentId] }));
}
