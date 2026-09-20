export const RECOGNITION_SCHEMA_VERSION = 'recognition-v0' as const;
export const CLIENT_PREPROCESS_VERSION = 'opencv-v1';

export interface BoundingBox {
	x0: number;
	y0: number;
	x1: number;
	y1: number;
}

export interface RegionProposal {
	id: string;
	box: BoundingBox;
	local_label: string | null;
	local_confidence: number | null;
}

export interface RecognitionRequest {
	schema_version: typeof RECOGNITION_SCHEMA_VERSION;
	client_preprocess_version: string;
	image_width: number;
	image_height: number;
	regions: RegionProposal[];
}

export interface LabelScore {
	label: string;
	confidence: number;
}

export interface RegionPrediction {
	region_id: string;
	label: string;
	confidence: number;
	alternatives: LabelScore[];
	local_label: string | null;
}

export interface Detection {
	box: BoundingBox;
	label: string;
	confidence: number;
}

export interface RecognitionResult {
	schema_version: typeof RECOGNITION_SCHEMA_VERSION;
	label_set_version: string;
	preprocess_version: string;
	client_preprocess_version: string;
	classifier_version: string | null;
	detector_version: string | null;
	regions: RegionPrediction[];
	detections: Detection[];
}

export interface OpenCvRecognitionInput {
	imageDataUrl: string;
	request: RecognitionRequest;
}
