import { diagramToCircuit } from './diagram/circuit';
import { inkFromScan, type PreparedScan } from './opencvRecognition';
import type { RecognitionResult } from './recognition';
import type { CircuitState } from './types';
import { diagramFromInk } from './vision/build';
import { strokeThickness } from './vision/components';
import { reconcile, withUnsureKept } from './vision/reconcile';
import { state } from './vision/state';
import { tightenRegions } from './vision/sweep';

/**
 * Turns what the model said about a capture into a circuit: merges its answer with the first pass and the
 * sweep, works out from the ink which pins are wired together, and lays the result out for the editor.
 * The result is a best guess for the user to fix up, so it favours keeping things. With no model answer
 * (`null`) it is built from the on-device scan alone.
 */
export async function circuitFromRecognition(
	input: PreparedScan,
	result: RecognitionResult | null
): Promise<{ circuit: Pick<CircuitState, 'components' | 'wires' | 'nodes'>; summary: string }> {
	// The very ink, at the very scale, the boxes were found on.
	state.detectScale = input.scan.detectScale;
	const ink = await inkFromScan(input.scan);
	try {
		const found = reconcile(tightenRegions(ink, input.request.regions), result?.regions ?? []);
		const components = result === null ? withUnsureKept(found) : found.components;
		const { diagram, report } = diagramFromInk(components, ink, strokeThickness(ink));
		const circuit = diagramToCircuit(diagram);
		const loose = report.loose.length ? ` ${report.loose.length} part${report.loose.length === 1 ? ' has' : 's have'} no wires.` : '';
		return {
			circuit,
			summary: `Found ${report.parts} part${report.parts === 1 ? '' : 's'} and ${report.connections} wire${report.connections === 1 ? '' : 's'}.${loose} Check it against your drawing.`
		};
	} finally {
		ink.delete();
	}
}
