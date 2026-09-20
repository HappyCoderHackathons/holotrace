import type { CircuitIr, ValidationIssue } from './types';

export interface AdapterCapability {
	supported: boolean;
	issues: ValidationIssue[];
}

export interface SimulationAdapter<TProject, TState> {
	readonly id: string;
	check(circuit: CircuitIr): AdapterCapability;
	export(circuit: CircuitIr): TProject;
	normalizeState(engineState: unknown): TState;
}
