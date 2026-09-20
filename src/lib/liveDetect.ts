import cv from 'opencv-ts';
import type { Rect } from './vision/boxes';
import { findCircuitInGray } from './vision/circuit';
import { BLOB_KERNELS_STILL } from './vision/config';
import { detectScaleFor } from './vision/state';
import { waitForOpenCv } from './opencvRecognition';

/** The circuit found in a camera frame, in the frame's own pixels. */
export interface LiveCircuit {
	box: Rect;
	/** Whether its lines enclose a loop; only a closed circuit counts as complete. */
	closed: boolean;
}

/**
 * Finds the circuit in live camera frames, the way the dev page's live stage does and the way `locateCircuit` will when
 * the photo is scanned, so the box drawn on screen is what will be cropped. The caller decides how often to ask.
 */
export class LiveDetector {
	private canvas = document.createElement('canvas');

	/** Resolves once OpenCV is loaded and ready. */
	static async create(): Promise<LiveDetector> {
		await waitForOpenCv();
		return new LiveDetector();
	}

	/** The circuit in the video's current frame, or null when no whole circuit is in view. */
	detect(video: HTMLVideoElement): LiveCircuit | null {
		const { videoWidth, videoHeight } = video;
		if (!videoWidth || !videoHeight) return null;
		// Looked at on a small copy, as the still is, to stay fast; the box is scaled back up afterwards.
		const scale = detectScaleFor(videoWidth);
		const width = Math.round(videoWidth / scale);
		const height = Math.round(videoHeight / scale);
		this.canvas.width = width;
		this.canvas.height = height;
		const context = this.canvas.getContext('2d', { willReadFrequently: true });
		if (!context) return null;
		context.drawImage(video, 0, 0, width, height);

		const frame = cv.imread(this.canvas);
		const gray = new cv.Mat();
		const blurred = new cv.Mat();
		try {
			cv.cvtColor(frame, gray, cv.COLOR_RGBA2GRAY);
			cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);
			const found = findCircuitInGray(blurred, frame, BLOB_KERNELS_STILL);
			if (found === null) return null;
			found.mask?.delete();
			const { x, y, width: w, height: h } = found.box;
			return { box: { x: x * scale, y: y * scale, width: w * scale, height: h * scale }, closed: found.closed };
		} finally {
			blurred.delete();
			gray.delete();
			frame.delete();
		}
	}
}
