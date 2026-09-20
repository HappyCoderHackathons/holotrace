import type { RecognitionResult } from './recognition';

/** Each one is a part in `diagram/parts.ts`, named without the `holotrace-` prefix. */
export type ComponentType =
	| 'battery'
	| 'led'
	| 'resistor'
	| 'switch'
	| 'capacitor'
	| 'pushbutton'
	| 'potentiometer'
	| 'diode'
	| 'lamp'
	| 'ac-source'
	| 'ground'
	| 'terminal'
	| 'and'
	| 'or'
	| 'nand'
	| 'nor'
	| 'xor'
	| 'not'
	| 'generic';

export interface Pin {
	id: string;
	/** offset from component origin, in canvas units */
	x: number;
	y: number;
	label: string;
}

export interface CircuitComponent {
	id: string;
	refId: string; // e.g. "R1", "LED1", "BAT1"
	type: ComponentType;
	label: string;
	x: number;
	y: number;
	rotation: 0 | 90 | 180 | 270;
	mirrored: boolean;
	value?: string; // e.g. "220Ω", "3V"
	color?: string;
	pins: Pin[];
}

/** One end of a wire: a component's pin, or a junction node where wires meet. */
export type WireEnd = { componentId: string; pinId: string } | { nodeId: string };

/** A junction: a point on the canvas that wires end at, so a wire can join another wire. */
export interface WireNode {
	id: string;
	x: number;
	y: number;
}

/**
 * A wire says only what it connects. The canvas routes the line at right angles
 * between its ends; `waypoints` are corners the user has pulled it through.
 */
export interface Wire {
	id: string;
	from: WireEnd;
	to: WireEnd;
	color: string;
	style: 'solid' | 'dashed';
	waypoints?: { x: number; y: number }[];
}

export interface DetectionInfo {
	sourceImage: string | null;
	status: string;
	detectedAt: number | null;
	/** Raw model evidence. It remains separate from normalized Circuit IR. */
	recognition?: RecognitionResult;
}

export type ViewMode = 'circuit' | 'schematic' | 'components';
export type EditTool = 'select' | 'wire' | 'pan';

export interface SimulationState {
	running: boolean;
	current: Record<string, number>; // wireId -> current magnitude (0-1 normalized)
	nodeVoltage: Record<string, number>; // componentId -> voltage
	ledOn: Record<string, boolean>; // componentId -> is lit
}

export interface CircuitState {
	components: CircuitComponent[];
	wires: Wire[];
	nodes: WireNode[];
	detection: DetectionInfo;
}
