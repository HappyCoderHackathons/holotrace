import type { Bounds, Point } from './types';

export const OPENCV_ANALYSIS_VERSION = 'opencv-analysis-v0' as const;

export interface OpenCvRegion {
	id: string;
	box: Bounds;
	rotationDegrees?: number;
	localLabel?: string | null;
	localConfidence?: number | null;
}

export type WireNodeKind = 'endpoint' | 'junction' | 'crossover' | 'bend';

export interface WireNode {
	id: string;
	point: Point;
	kind: WireNodeKind;
}

export interface WireSegment {
	id: string;
	fromNodeId: string;
	toNodeId: string;
	points: Point[];
}

export interface OpenCvAnalysis {
	schemaVersion: typeof OPENCV_ANALYSIS_VERSION;
	preprocessVersion: string;
	imageWidth: number;
	imageHeight: number;
	regions: OpenCvRegion[];
	wireGraph: {
		nodes: WireNode[];
		segments: WireSegment[];
	};
}

export interface RecognitionAlternative {
	label: string;
	confidence: number;
}

export interface RegionPrediction {
	region_id: string;
	label: string;
	confidence: number;
	alternatives: RecognitionAlternative[];
	local_label: string | null;
}

export interface RecognitionResult {
	schema_version: 'recognition-v0';
	label_set_version: string;
	preprocess_version: string;
	client_preprocess_version: string;
	classifier_version: string | null;
	detector_version: string | null;
	regions: RegionPrediction[];
	detections: Array<{
		box: Bounds;
		label: string;
		confidence: number;
	}>;
}
