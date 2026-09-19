import { writable, derived, get } from 'svelte/store';
import type {
	CircuitComponent,
	CircuitState,
	ComponentType,
	Wire,
	ViewMode,
	EditTool
} from '../types';
import { REF_PREFIX, defaultPins, PALETTE } from '../componentLibrary';
import { createId } from '../id';

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
			fromComponentId: battery.id,
			fromPinId: 'pos',
			toComponentId: led.id,
			toPinId: 'k',
			color: '#22c55e',
			style: 'solid',
			waypoints: [
				{ x: 300, y: 360 },
				{ x: 300, y: 120 }
			]
		},
		{
			id: createId(),
			fromComponentId: led.id,
			fromPinId: 'a',
			toComponentId: resistor.id,
			toPinId: '2',
			color: '#22c55e',
			style: 'solid'
		},
		{
			id: createId(),
			fromComponentId: resistor.id,
			fromPinId: '1',
			toComponentId: battery.id,
			toPinId: 'neg',
			color: '#111827',
			style: 'solid',
			waypoints: [
				{ x: 540, y: 220 },
				{ x: 540, y: 360 }
			]
		}
	];

	return {
		components: [battery, resistor, led],
		wires,
		detection: {
			sourceImage: null,
			status: 'Circuit detected: LED + resistor + coin cell battery',
			detectedAt: Date.now()
		}
	};
}

export const circuit = writable<CircuitState>(sampleCircuit());

export const viewMode = writable<ViewMode>('circuit');
export const editMode = writable<boolean>(false);
export const editTool = writable<EditTool>('select');
export const selectedIds = writable<Set<string>>(new Set());
export const selectedWireIds = writable<Set<string>>(new Set());
export const wireColor = writable<string>('#22c55e');
export const wireStyle = writable<'solid' | 'dashed'>('solid');
export const leftSidebarOpen = writable<boolean>(true);
export const rightSidebarOpen = writable<boolean>(true);
export const canvasZoom = writable<number>(1);
export const canvasPan = writable<{ x: number; y: number }>({ x: 0, y: 0 });

// ---- history (undo/redo) ----
const history: CircuitState[] = [];
let historyIndex = -1;
let suppressHistory = false;

function pushHistory(state: CircuitState) {
	if (suppressHistory) return;
	history.splice(historyIndex + 1);
	history.push(JSON.parse(JSON.stringify(state)));
	historyIndex = history.length - 1;
	if (history.length > 50) {
		history.shift();
		historyIndex--;
	}
}

circuit.subscribe((state) => pushHistory(state));

export function undo() {
	if (historyIndex <= 0) return;
	historyIndex--;
	suppressHistory = true;
	circuit.set(JSON.parse(JSON.stringify(history[historyIndex])));
	suppressHistory = false;
}

export function redo() {
	if (historyIndex >= history.length - 1) return;
	historyIndex++;
	suppressHistory = true;
	circuit.set(JSON.parse(JSON.stringify(history[historyIndex])));
	suppressHistory = false;
}

export const canUndo = derived([circuit], () => historyIndex > 0);
export const canRedo = derived([circuit], () => historyIndex < history.length - 1);

// ---- mutation helpers ----
function nextRefId(type: ComponentType): string {
	const prefix = REF_PREFIX[type];
	const state = get(circuit);
	const existing = state.components
		.filter((c) => c.type === type)
		.map((c) => parseInt(c.refId.replace(prefix, ''), 10) || 0);
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

export function removeComponent(id: string) {
	circuit.update((state) => ({
		...state,
		components: state.components.filter((c) => c.id !== id),
		wires: state.wires.filter((w) => w.fromComponentId !== id && w.toComponentId !== id)
	}));
	selectedIds.update((s) => {
		s.delete(id);
		return new Set(s);
	});
}

export function removeWire(id: string) {
	circuit.update((state) => ({ ...state, wires: state.wires.filter((w) => w.id !== id) }));
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
	circuit.update((state) => ({
		...state,
		wires: [...state.wires, { ...wire, id: createId() }]
	}));
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

export function addWireWaypoint(wireId: string, x: number, y: number, atIndex?: number) {
	circuit.update((state) => ({
		...state,
		wires: state.wires.map((w) => {
			if (w.id !== wireId) return w;
			const waypoints = [...(w.waypoints ?? [])];
			const insertAt = atIndex === undefined ? waypoints.length : atIndex;
			waypoints.splice(insertAt, 0, { x, y });
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

export function deleteSelected() {
	const ids = get(selectedIds);
	const wireIds = get(selectedWireIds);
	ids.forEach((id) => removeComponent(id));
	wireIds.forEach((id) => removeWire(id));
	selectedWireIds.set(new Set());
}

export function clearSelection() {
	selectedIds.set(new Set());
	selectedWireIds.set(new Set());
}

export function loadDetectedCircuit(state: CircuitState) {
	suppressHistory = true;
	circuit.set(state);
	suppressHistory = false;
	pushHistory(state);
	clearSelection();
}
