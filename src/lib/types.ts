import type { RecognitionResult } from './recognition';

export type ComponentType =
	| 'battery'
	| 'led'
	| 'resistor'
	| 'switch'
	| 'capacitor'
	| 'pushbutton'
	| 'potentiometer';

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

export interface Wire {
	id: string;
	fromComponentId: string;
	fromPinId: string;
	toComponentId: string;
	toPinId: string;
	color: string;
	style: 'solid' | 'dashed';
	/** optional user-added waypoints for routing */
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
	detection: DetectionInfo;
}
