import { getPinTemplate, isComponentLabel, type PinTemplate } from './pin-templates';
import type { OpenCvAnalysis, RecognitionResult, WireNode } from './recognition';
import {
	CIRCUIT_IR_VERSION,
	type Bounds,
	type CircuitComponent,
	type CircuitNet,
	type NormalizationResult,
	type Point,
	type SourceComponentPlacement,
	type ValidationIssue
} from './types';

export interface NormalizationOptions {
	snapDistancePx?: number;
	lowConfidenceThreshold?: number;
}

class DisjointSet {
	private readonly parent = new Map<string, string>();

	add(value: string): void {
		if (!this.parent.has(value)) this.parent.set(value, value);
	}

	find(value: string): string {
		const parent = this.parent.get(value);
		if (parent === undefined) throw new Error(`Unknown wire node ${value}`);
		if (parent === value) return value;
		const root = this.find(parent);
		this.parent.set(value, root);
		return root;
	}

	union(left: string, right: string): void {
		const leftRoot = this.find(left);
		const rightRoot = this.find(right);
		if (leftRoot !== rightRoot) this.parent.set(rightRoot, leftRoot);
	}
}

function distance(left: Point, right: Point): number {
	return Math.hypot(left.x - right.x, left.y - right.y);
}

function pinPoint(bounds: Bounds, rotationDegrees: number, pin: PinTemplate): Point {
	const center = { x: (bounds.x0 + bounds.x1) / 2, y: (bounds.y0 + bounds.y1) / 2 };
	const local = {
		x: pin.position.x * (bounds.x1 - bounds.x0),
		y: pin.position.y * (bounds.y1 - bounds.y0)
	};
	const radians = (rotationDegrees * Math.PI) / 180;
	return {
		x: center.x + local.x * Math.cos(radians) - local.y * Math.sin(radians),
		y: center.y + local.x * Math.sin(radians) + local.y * Math.cos(radians)
	};
}

export function normalizeCircuit(
	analysis: OpenCvAnalysis,
	recognition: RecognitionResult,
	options: NormalizationOptions = {}
): NormalizationResult {
	const issues: ValidationIssue[] = [];
	const predictionByRegion = new Map(recognition.regions.map((prediction) => [prediction.region_id, prediction]));
	const nodeById = new Map(analysis.wireGraph.nodes.map((node) => [node.id, node]));
	const graph = new DisjointSet();

	for (const node of analysis.wireGraph.nodes) graph.add(node.id);
	for (const segment of analysis.wireGraph.segments) {
		if (!nodeById.has(segment.fromNodeId) || !nodeById.has(segment.toNodeId)) {
			issues.push({
				id: `invalid-wire-${segment.id}`,
				severity: 'error',
				code: 'invalid_wire_segment',
				message: `Wire segment ${segment.id} refers to a missing endpoint.`
			});
			continue;
		}
		graph.union(segment.fromNodeId, segment.toNodeId);
	}

	const snapDistance =
		options.snapDistancePx ?? Math.max(4, Math.min(analysis.imageWidth, analysis.imageHeight) * 0.015);
	const lowConfidence = options.lowConfidenceThreshold ?? 0.65;
	const components: CircuitComponent[] = [];
	const placements: SourceComponentPlacement[] = [];
	const pinRoots = new Map<string, string>();

	for (const region of analysis.regions) {
		const prediction = predictionByRegion.get(region.id);
		if (!prediction) {
			issues.push({
				id: `missing-prediction-${region.id}`,
				severity: 'warning',
				code: 'missing_prediction',
				message: `No classifier result was returned for region ${region.id}.`,
				regionId: region.id
			});
			continue;
		}
		if (!isComponentLabel(prediction.label)) continue;

		const componentId = `component-${region.id}`;
		const template = getPinTemplate(prediction.label);
		if (!template) {
			issues.push({
				id: `unsupported-${componentId}`,
				severity: 'error',
				code: 'unsupported_component',
				message: `No pin template is defined for ${prediction.label}.`,
				componentId,
				regionId: region.id
			});
		}
		if (prediction.confidence < lowConfidence) {
			issues.push({
				id: `low-confidence-${componentId}`,
				severity: 'warning',
				code: 'low_confidence',
				message: `${prediction.label} was recognized with ${(prediction.confidence * 100).toFixed(1)}% confidence.`,
				componentId,
				regionId: region.id
			});
		}

		const rotationDegrees = region.rotationDegrees ?? 0;
		const placementPins = (template ?? []).map((pin) => ({
			pinKey: pin.key,
			point: pinPoint(region.box, rotationDegrees, pin)
		}));
		const component: CircuitComponent = {
			id: componentId,
			type: prediction.label,
			properties: {},
			pins: (template ?? []).map((pin) => ({
				key: pin.key,
				name: pin.name,
				electricalRole: pin.electricalRole,
				netId: null
			})),
			recognition: {
				sourceRegionId: region.id,
				label: prediction.label,
				confidence: prediction.confidence,
				alternatives: prediction.alternatives
			}
		};

		for (const pin of placementPins) {
			const candidates = analysis.wireGraph.nodes
				.map((node) => ({ node, distance: distance(pin.point, node.point), root: graph.find(node.id) }))
				.filter((candidate) => candidate.distance <= snapDistance)
				.sort((left, right) => left.distance - right.distance);
			const nearest = candidates[0];
			const competing = candidates.find(
				(candidate) => candidate.root !== nearest?.root && candidate.distance - (nearest?.distance ?? 0) <= 1
			);
			if (nearest && !competing) {
				pinRoots.set(`${componentId}:${pin.pinKey}`, nearest.root);
			} else if (nearest && competing) {
				issues.push({
					id: `ambiguous-${componentId}-${pin.pinKey}`,
					severity: 'warning',
					code: 'ambiguous_connection',
					message: `${componentId}.${pin.pinKey} is equally close to multiple wire networks.`,
					componentId,
					pinKey: pin.pinKey
				});
			}
		}

		components.push(component);
		placements.push({ componentId, bounds: region.box, rotationDegrees, pins: placementPins });
	}

	const rootsWithPins = [...new Set(pinRoots.values())].sort();
	const netIdByRoot = new Map(rootsWithPins.map((root, index) => [root, `net-${index + 1}`]));
	const netsById = new Map<string, CircuitNet>();
	for (const netId of netIdByRoot.values()) netsById.set(netId, { id: netId, name: null, members: [] });

	for (const component of components) {
		for (const pin of component.pins) {
			const root = pinRoots.get(`${component.id}:${pin.key}`);
			const netId = root ? (netIdByRoot.get(root) ?? null) : null;
			pin.netId = netId;
			if (netId) {
				netsById.get(netId)?.members.push({ componentId: component.id, pinKey: pin.key });
			} else {
				issues.push({
					id: `unconnected-${component.id}-${pin.key}`,
					severity: 'warning',
					code: 'unconnected_pin',
					message: `${component.id}.${pin.key} is not connected to a wire network.`,
					componentId: component.id,
					pinKey: pin.key
				});
			}
		}
	}

	if (!components.some((component) => component.type === 'gnd')) {
		issues.push({
			id: 'missing-ground',
			severity: 'warning',
			code: 'missing_ground',
			message: 'No ground or reference component was recognized.'
		});
	}

	const rootForNode = (node: WireNode): string => graph.find(node.id);
	return {
		circuit: {
			schemaVersion: CIRCUIT_IR_VERSION,
			components,
			nets: [...netsById.values()],
			provenance: {
				recognitionSchemaVersion: recognition.schema_version,
				classifierVersion: recognition.classifier_version,
				detectorVersion: recognition.detector_version,
				clientPreprocessVersion: recognition.client_preprocess_version
			}
		},
		sourceLayout: {
			imageWidth: analysis.imageWidth,
			imageHeight: analysis.imageHeight,
			components: placements,
			wires: analysis.wireGraph.segments.map((segment) => {
				const from = nodeById.get(segment.fromNodeId);
				const root = from ? rootForNode(from) : null;
				return {
					id: segment.id,
					netId: root ? (netIdByRoot.get(root) ?? null) : null,
					points: segment.points
				};
			})
		},
		issues
	};
}
