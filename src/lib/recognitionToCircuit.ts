import cv from 'opencv-ts';
import { detectScaleOf } from './opencvRecognition';
import { buildDiagram } from './diagram/diagram';
import { diagramToCircuit } from './diagram/circuit';
import { partForLabel } from './diagram/parts';
import type { OpenCvRecognitionInput, RecognitionResult } from './recognition';
import type { CircuitState } from './types';
import { toRect } from './vision/boxes';
import { orientation } from './vision/classify';
import { strokeThickness } from './vision/components';
import { DETECT_WIDTH } from './vision/config';
import { inkMask } from './vision/ink';
import { symbolsFor } from './vision/labels';
import { reconcile } from './vision/reconcile';
import { state } from './vision/state';
import { tightenRegions } from './vision/sweep';
import { traceWires } from './vision/wires';

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const image = new Image();
		image.onload = () => resolve(image);
		image.onerror = () => reject(new Error('The captured image could not be read back.'));
		image.src = dataUrl;
	});
}

/**
 * Turns what the model said about a capture into a circuit: merges its answer with the first pass and the
 * sweep, works out from the ink which pins are wired together, and lays the result out for the editor.
 * The result is a best guess for the user to fix up, so it favours keeping things.
 */
export async function circuitFromRecognition(
	input: OpenCvRecognitionInput,
	result: RecognitionResult | null
): Promise<{ circuit: Pick<CircuitState, 'components' | 'wires' | 'nodes'>; summary: string }> {
	const image = await loadImage(input.imageDataUrl);
	const source = cv.imread(image);
	state.detectScale = detectScaleOf(input) ?? Math.max(1, source.cols / DETECT_WIDTH);
	state.capturedMask?.delete();
	state.capturedMask = null;
	const ink = inkMask(source);
	source.delete();
	try {
		const found = reconcile(tightenRegions(ink, input.request.regions), result?.regions ?? []);
		// With no model to say what a box is, the first pass's unsure boxes are kept as generic parts, so nothing is lost.
		const merged = {
			components:
				result === null
					? [
							...found.components,
							...found.dropped.map((region) => ({
								box: region.box,
								label: region.local_label ?? 'part',
								confidence: region.local_confidence ?? 0,
								source: 'kept' as const,
								regionId: region.id,
								localLabel: region.local_label,
								modelLabel: null
							}))
						]
					: found.components
		};
		const boxes = merged.components.map((component) => toRect(component.box));
		const graph = traceWires(ink, boxes, strokeThickness(ink));
		const orientations = merged.components.map((component, n) =>
			partForLabel(component.label).directional ? orientation(ink, boxes[n], symbolsFor(component.label)) : null
		);
		const { diagram, report } = buildDiagram({ components: merged.components, orientations, graph });
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
