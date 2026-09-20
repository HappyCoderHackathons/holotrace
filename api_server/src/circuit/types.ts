export const CIRCUIT_IR_VERSION = 'circuit-ir-v0' as const;

export interface Point {
	x: number;
	y: number;
}

export interface Bounds {
	x0: number;
	y0: number;
	x1: number;
	y1: number;
}

export type PinRole = 'input' | 'output' | 'power' | 'ground' | 'passive' | 'control' | 'unknown';

export interface CircuitPin {
	key: string;
	name: string;
	electricalRole: PinRole;
	netId: string | null;
}

export interface CircuitComponent {
	id: string;
	type: string;
	properties: Record<string, string | number | boolean | null>;
	pins: CircuitPin[];
	recognition: {
		sourceRegionId: string;
		label: string;
		confidence: number;
		alternatives: Array<{ label: string; confidence: number }>;
	};
}

export interface CircuitNetMember {
	componentId: string;
	pinKey: string;
}

export interface CircuitNet {
	id: string;
	name: string | null;
	members: CircuitNetMember[];
}

export interface CircuitIr {
	schemaVersion: typeof CIRCUIT_IR_VERSION;
	components: CircuitComponent[];
	nets: CircuitNet[];
	provenance: {
		recognitionSchemaVersion: string;
		classifierVersion: string | null;
		detectorVersion: string | null;
		clientPreprocessVersion: string;
	};
}

export type ValidationSeverity = 'info' | 'warning' | 'error';

export interface ValidationIssue {
	id: string;
	severity: ValidationSeverity;
	code:
		| 'missing_prediction'
		| 'unsupported_component'
		| 'low_confidence'
		| 'unconnected_pin'
		| 'ambiguous_connection'
		| 'invalid_wire_segment'
		| 'missing_ground';
	message: string;
	componentId?: string;
	pinKey?: string;
	regionId?: string;
}

export interface SourceComponentPlacement {
	componentId: string;
	bounds: Bounds;
	rotationDegrees: number;
	pins: Array<{ pinKey: string; point: Point }>;
}

export interface SourceWirePath {
	id: string;
	netId: string | null;
	points: Point[];
}

export interface SourceCircuitLayout {
	imageWidth: number;
	imageHeight: number;
	components: SourceComponentPlacement[];
	wires: SourceWirePath[];
}

export interface NormalizationResult {
	circuit: CircuitIr;
	sourceLayout: SourceCircuitLayout;
	issues: ValidationIssue[];
}
