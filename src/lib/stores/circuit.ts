import { writable, derived, get } from 'svelte/store';
import type {
	CircuitComponent,
	CircuitState,
	ComponentType,
	Wire,
	WireEnd,
	ViewMode
} from '../types';
import { REF_PREFIX, defaultPins, PALETTE } from '../componentLibrary';
import { createId } from '../id';
import { circuitToDiagram, diagramToCircuit } from '../diagram/circuit';
import { parseDiagram, type Diagram } from '../diagram/diagram';
import { sameEnd } from '../geometry';

function sampleCircuit(): CircuitState {
	const battery: CircuitComponent = {
		id: createId(),
		refId: 'BAT1',
		type: 'battery',
		label: 'Coin Cell 3V Battery',
		x: 420,
		y: 360,
		rotation: 0,
		mirrored: false,
		value: '3V',
		pins: defaultPins('battery')
	};
	const resistor: CircuitComponent = {
		id: createId(),
		refId: 'R1',
		type: 'resistor',
		label: 'Resistor',
		x: 420,
		y: 220,
		rotation: 90,
		mirrored: false,
		value: '220Ω',
		pins: defaultPins('resistor')
	};
	const led: CircuitComponent = {
		id: createId(),
		refId: 'D1',
		type: 'led',
		label: 'LED',
		x: 420,
		y: 120,
		rotation: 90,
		mirrored: false,
		value: 'Red',
		color: '#e11d2e',
		pins: defaultPins('led')
	};

	const wires: Wire[] = [
		{
			id: createId(),
			from: { componentId: battery.id, pinId: 'pos' },
			to: { componentId: led.id, pinId: 'k' },
			color: '#22c55e',
			style: 'solid'
		},
		{
			id: createId(),
			from: { componentId: led.id, pinId: 'a' },
			to: { componentId: resistor.id, pinId: '2' },
			color: '#22c55e',
			style: 'solid'
		},
		{
			id: createId(),
			from: { componentId: resistor.id, pinId: '1' },
			to: { componentId: battery.id, pinId: 'neg' },
			color: '#111827',
			style: 'solid'
		}
	];

	return {
		components: [battery, resistor, led],
		wires,
		nodes: [],
		detection: {
			sourceImage: null,
			status: 'Circuit detected: LED + resistor + coin cell battery',
			detectedAt: Date.now()
		}
	};
}

function emptyCircuit(): CircuitState {
	return {
		components: [],
		wires: [],
		nodes: [],
		detection: { sourceImage: null, status: 'New circuit', detectedAt: null }
	};
}

// The sample loop is only there to try the editor with in development; a release starts empty.
export const circuit = writable<CircuitState>(import.meta.env.DEV ? sampleCircuit() : emptyCircuit());

export const viewMode = writable<ViewMode>('circuit');
export const editMode = writable<boolean>(false);
export const selectedIds = writable<Set<string>>(new Set());
export const selectedWireIds = writable<Set<string>>(new Set());
/** The end a wire is being drawn from, waiting for its other end. */
export const pendingWire = writable<WireEnd | null>(null);
/** Bumped when the canvas should frame the whole circuit (after a load, an import, a new circuit). */
export const fitRequest = writable<number>(0);
/** The middle of what the canvas shows, in canvas units: where a part placed from the palette goes. */
export const viewCentre = writable<{ x: number; y: number }>({ x: 480, y: 300 });
export const selectedNodeIds = writable<Set<string>>(new Set());
export const wireColor = writable<string>('#16a34a');
export const wireStyle = writable<'solid' | 'dashed'>('solid');
export const canvasZoom = writable<number>(1);
export const canvasPan = writable<{ x: number; y: number }>({ x: 0, y: 0 });

// ---- history (undo/redo) ----
// What undo restores: the parts, wires and junctions. The captured photo and the model's answer (`detection`) are not
// part of the history: they can be megabytes, and an edit does not change them.
type Snapshot = Pick<CircuitState, 'components' | 'wires' | 'nodes'>;

const history: Snapshot[] = [];
let historyIndex = -1;
let suppressHistory = false;
let lastSeen: CircuitState | null = null;
/** While a drag is under way the intermediate states are not kept; the finished one is (see beginGesture). */
let gestureOpen = false;
let gestureChanged = false;
/** Bumped whenever the history changes, so canUndo and canRedo follow it. */
const historyVersion = writable(0);

function snapshotOf(state: CircuitState): Snapshot {
	return JSON.parse(JSON.stringify({ components: state.components, wires: state.wires, nodes: state.nodes }));
}

function pushHistory(state: CircuitState) {
	history.splice(historyIndex + 1);
	history.push(snapshotOf(state));
	historyIndex = history.length - 1;
	if (history.length > 50) {
		history.shift();
		historyIndex--;
	}
	historyVersion.update((n) => n + 1);
}

circuit.subscribe((state) => {
	// An update that changes nothing hands back the same object: it is not a step to undo.
	if (state === lastSeen) return;
	lastSeen = state;
	if (suppressHistory) return;
	if (gestureOpen) {
		gestureChanged = true;
		return;
	}
	pushHistory(state);
});

/** Call when a drag starts: everything it changes until endGesture is one undo step. */
export function beginGesture() {
	gestureOpen = true;
	gestureChanged = false;
}

/** Call when the drag ends. */
export function endGesture() {
	if (!gestureOpen) return;
	gestureOpen = false;
	if (gestureChanged) pushHistory(get(circuit));
	gestureChanged = false;
}

function restore(index: number) {
	suppressHistory = true;
	circuit.update((state) => ({ ...state, ...JSON.parse(JSON.stringify(history[index])) }));
	suppressHistory = false;
	pendingWire.set(null);
	clearSelection();
	historyVersion.update((n) => n + 1);
}

export function undo() {
	if (historyIndex <= 0) return;
	historyIndex--;
	restore(historyIndex);
}

export function redo() {
	if (historyIndex >= history.length - 1) return;
	historyIndex++;
	restore(historyIndex);
}

export const canUndo = derived([historyVersion], () => historyIndex > 0);
export const canRedo = derived([historyVersion], () => historyIndex < history.length - 1);

// ---- mutation helpers ----
function nextRefId(type: ComponentType): string {
	const prefix = REF_PREFIX[type];
	const state = get(circuit);
	// Counted by prefix, not by type: an LED and a diode are both D, so the next is D2 whichever is added.
	const existing = state.components
		.map((c) => c.refId)
		.filter((ref) => ref.startsWith(prefix) && /^\d+$/.test(ref.slice(prefix.length)))
		.map((ref) => parseInt(ref.slice(prefix.length), 10));
	const next = existing.length ? Math.max(...existing) + 1 : 1;
	return `${prefix}${next}`;
}

export function addComponent(type: ComponentType, x: number, y: number) {
	const item = PALETTE.find((p) => p.type === type);
	circuit.update((state) => {
		const comp: CircuitComponent = {
			id: createId(),
			refId: nextRefId(type),
			type,
			label: item?.label ?? type,
			x,
			y,
			rotation: 0,
			mirrored: false,
			value: item?.defaultValue,
			color: item?.defaultColor,
			pins: defaultPins(type)
		};
		return { ...state, components: [...state.components, comp] };
	});
}

export function moveComponent(id: string, x: number, y: number) {
	circuit.update((state) => ({
		...state,
		components: state.components.map((c) => (c.id === id ? { ...c, x, y } : c))
	}));
}

export function rotateComponent(id: string) {
	circuit.update((state) => ({
		...state,
		components: state.components.map((c) =>
			c.id === id ? { ...c, rotation: (((c.rotation + 90) % 360) as 0 | 90 | 180 | 270) } : c
		)
	}));
}

export function mirrorComponent(id: string) {
	circuit.update((state) => ({
		...state,
		components: state.components.map((c) => (c.id === id ? { ...c, mirrored: !c.mirrored } : c))
	}));
}

export function addWire(wire: Omit<Wire, 'id'>) {
	circuit.update((state) => {
		const exists = (end: WireEnd) =>
			'nodeId' in end
				? state.nodes.some((n) => n.id === end.nodeId)
				: state.components.some((c) => c.id === end.componentId && c.pins.some((p) => p.id === end.pinId));
		if (!exists(wire.from) || !exists(wire.to)) return state;
		if (sameEnd(wire.from, wire.to)) return state;
		const alreadyWired = state.wires.some(
			(w) =>
				(sameEnd(w.from, wire.from) && sameEnd(w.to, wire.to)) ||
				(sameEnd(w.from, wire.to) && sameEnd(w.to, wire.from))
		);
		if (alreadyWired) return state;
		return { ...state, wires: [...state.wires, { ...wire, id: createId() }] };
	});
}

export function removeWire(id: string) {
	circuit.update((state) => tidyNodes({ ...state, wires: state.wires.filter((w) => w.id !== id) }));
}

/** Puts a junction on the canvas. Wires end at it like they do at a pin. */
export function addNode(x: number, y: number): string {
	const id = createId();
	circuit.update((state) => ({ ...state, nodes: [...state.nodes, { id, x, y }] }));
	return id;
}

export function moveNode(id: string, x: number, y: number) {
	circuit.update((state) => ({
		...state,
		nodes: state.nodes.map((n) => (n.id === id ? { ...n, x, y } : n))
	}));
}

/**
 * Splits a wire at a point: a junction goes there and the wire becomes two, so
 * another wire can start from the junction. Returns the junction's id.
 */
export function splitWire(wireId: string, x: number, y: number): string | null {
	const wire = get(circuit).wires.find((w) => w.id === wireId);
	if (!wire) return null;
	const nodeId = createId();
	circuit.update((state) => ({
		...state,
		nodes: [...state.nodes, { id: nodeId, x, y }],
		wires: [
			...state.wires.filter((w) => w.id !== wireId),
			{ ...wire, id: createId(), to: { nodeId }, waypoints: undefined },
			{ ...wire, id: createId(), from: { nodeId }, waypoints: undefined }
		]
	}));
	return nodeId;
}

/** Changes what a wire's end is joined to (dragging an end onto another pin or junction). */
export function reattachWire(wireId: string, which: 'from' | 'to', end: WireEnd) {
	circuit.update((state) => ({
		...state,
		wires: state.wires.map((w) => {
			if (w.id !== wireId) return w;
			const next = { ...w, [which]: end };
			return sameEnd(next.from, next.to) ? w : next;
		})
	}));
}

/** Sets all the corners a wire is routed through. */
export function setWireWaypoints(wireId: string, waypoints: { x: number; y: number }[]) {
	// A corner on top of the one before it does nothing, so it is not kept.
	const kept = waypoints.filter((p, i) => i === 0 || p.x !== waypoints[i - 1].x || p.y !== waypoints[i - 1].y);
	circuit.update((state) => ({
		...state,
		wires: state.wires.map((w) => (w.id === wireId ? { ...w, waypoints: kept } : w))
	}));
}

/** Forgets the corners a wire was pulled through, so it is routed afresh. */
export function resetWireRoute(id: string) {
	circuit.update((state) => ({
		...state,
		wires: state.wires.map((w) => (w.id === id ? { ...w, waypoints: undefined } : w))
	}));
}

export type ComponentPatch = Partial<Pick<CircuitComponent, 'refId' | 'label' | 'value' | 'color'>>;

export function updateComponent(id: string, patch: ComponentPatch) {
	circuit.update((state) => ({
		...state,
		components: state.components.map((c) => (c.id === id ? { ...c, ...patch } : c))
	}));
}

/**
 * A junction with fewer than two wires is not joining anything: it is dropped, and the one wire it was left holding
 * with it (that wire would end in mid-air). This can leave another junction short, so it repeats.
 */
function tidyNodes(state: CircuitState): CircuitState {
	let { nodes, wires } = state;
	for (let again = true; again; ) {
		again = false;
		const touches = (w: Wire, nodeId: string) =>
			('nodeId' in w.from && w.from.nodeId === nodeId) || ('nodeId' in w.to && w.to.nodeId === nodeId);
		const dead = nodes.filter((n) => wires.filter((w) => touches(w, n.id)).length < 2);
		if (dead.length) {
			const ids = new Set(dead.map((n) => n.id));
			nodes = nodes.filter((n) => !ids.has(n.id));
			wires = wires.filter((w) => ![...ids].some((id) => touches(w, id)));
			again = true;
		}
	}
	return { ...state, nodes, wires };
}

export function updateWireWaypoint(wireId: string, index: number, x: number, y: number) {
	circuit.update((state) => ({
		...state,
		wires: state.wires.map((w) => {
			if (w.id !== wireId) return w;
			const waypoints = [...(w.waypoints ?? [])];
			waypoints[index] = { x, y };
			return { ...w, waypoints };
		})
	}));
}

export function removeWireWaypoint(wireId: string, index: number) {
	circuit.update((state) => ({
		...state,
		wires: state.wires.map((w) => {
			if (w.id !== wireId) return w;
			const waypoints = [...(w.waypoints ?? [])];
			waypoints.splice(index, 1);
			return { ...w, waypoints };
		})
	}));
}

export function setWireColorFor(id: string, color: string) {
	circuit.update((state) => ({
		...state,
		wires: state.wires.map((w) => (w.id === id ? { ...w, color } : w))
	}));
}

export function setWireStyleFor(id: string, style: 'solid' | 'dashed') {
	circuit.update((state) => ({
		...state,
		wires: state.wires.map((w) => (w.id === id ? { ...w, style } : w))
	}));
}

/** Deletes the whole selection as a single undoable step. */
export function deleteSelected() {
	if (!get(editMode)) return;
	const componentIds = get(selectedIds);
	const wireIds = get(selectedWireIds);
	const nodeIds = get(selectedNodeIds);
	if (componentIds.size === 0 && wireIds.size === 0 && nodeIds.size === 0) return;

	const touches = (end: WireEnd) => ('nodeId' in end ? nodeIds.has(end.nodeId) : componentIds.has(end.componentId));
	circuit.update((state) =>
		tidyNodes({
			...state,
			components: state.components.filter((c) => !componentIds.has(c.id)),
			nodes: state.nodes.filter((n) => !nodeIds.has(n.id)),
			wires: state.wires.filter((w) => !wireIds.has(w.id) && !touches(w.from) && !touches(w.to))
		})
	);
	clearSelection();
}

export function clearSelection() {
	selectedIds.set(new Set());
	selectedWireIds.set(new Set());
	selectedNodeIds.set(new Set());
}

/** Replaces the working circuit with a freshly recognized one, resetting history. */
export function loadDetectedCircuit(state: CircuitState) {
	history.length = 0;
	historyIndex = -1;
	gestureOpen = false;
	circuit.set(state);
	pendingWire.set(null);
	clearSelection();
	fitRequest.update((n) => n + 1);
}

/**
 * Replaces the circuit as one undoable step (Import, New), so a mistaken replace can be taken back.
 * Junctions and selection go with the old circuit.
 */
function replaceCircuit(state: CircuitState) {
	circuit.set(state);
	pendingWire.set(null);
	clearSelection();
	fitRequest.update((n) => n + 1);
}

/** Starts over with an empty canvas. */
export function newCircuit() {
	replaceCircuit({
		components: [],
		wires: [],
		nodes: [],
		detection: { sourceImage: null, status: 'New circuit', detectedAt: null }
	});
}

/** The circuit as a diagram, in the format the rest of the tools read and write. */
export function exportDiagram(): Diagram {
	return circuitToDiagram(get(circuit));
}

/** Replaces the circuit with a diagram read from a file. Returns what could not be used, or an error. */
export function loadDiagram(input: unknown): { warnings: string[] } | { error: string } {
	const parsed = parseDiagram(input);
	if ('error' in parsed) return parsed;
	const { components, wires, nodes } = diagramToCircuit(parsed.diagram);
	replaceCircuit({
		components,
		wires,
		nodes,
		detection: {
			sourceImage: null,
			status: `Imported ${components.length} parts and ${wires.length} wires`,
			detectedAt: Date.now()
		}
	});
	return { warnings: parsed.warnings };
}
