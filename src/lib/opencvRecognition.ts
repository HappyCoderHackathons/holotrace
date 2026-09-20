import cv, { type Mat } from 'opencv-ts';
import { DETECT_WIDTH, SHARPEN_AMOUNT, SHARPEN_SIGMA } from '../../opencv/config';
import { buildRecognition } from '../../opencv/recognition';
import { state } from '../../opencv/state';
import { classify } from '../../opencv/vision/classify';
import { findComponents } from '../../opencv/vision/components';
import { inkMask } from '../../opencv/vision/ink';
import type { OpenCvRecognitionInput } from './recognition';

function waitForOpenCv(): Promise<void> {
	try {
		const probe = new cv.Mat();
		probe.delete();
		return Promise.resolve();
	} catch {
		return new Promise((resolve, reject) => {
			const runtime = cv as typeof cv & { onRuntimeInitialized?: () => void };
			const previous = runtime.onRuntimeInitialized;
			const timeout = window.setTimeout(
				() => reject(new Error('OpenCV did not finish loading. Reload the app and try again.')),
				15_000
			);
			runtime.onRuntimeInitialized = () => {
				previous?.();
				window.clearTimeout(timeout);
				resolve();
			};
		});
	}
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const image = new Image();
		image.onload = () => resolve(image);
		image.onerror = () => reject(new Error('OpenCV could not decode the selected image.'));
		image.src = dataUrl;
	});
}

function canvasAsPngDataUrl(canvas: HTMLCanvasElement): Promise<string> {
	return new Promise((resolve, reject) => {
		canvas.toBlob((blob) => {
			if (!blob) {
				reject(new Error('OpenCV could not encode the processed image.'));
				return;
			}
			const reader = new FileReader();
			reader.onload = () => resolve(reader.result as string);
			reader.onerror = () => reject(new Error('Could not read the processed image.'));
			reader.readAsDataURL(blob);
		}, 'image/png');
	});
}

/** Runs the inexpensive client pass and returns the exact image and pixel-space regions sent to ML. */
export async function prepareRecognitionInput(sourceDataUrl: string): Promise<OpenCvRecognitionInput> {
	await waitForOpenCv();
	const image = await loadImage(sourceDataUrl);
	const source = cv.imread(image);
	const blurred = new cv.Mat();
	const sharpened = new cv.Mat();
	let ink: Mat | null = null;

	try {
		state.detectScale = Math.max(1, source.cols / DETECT_WIDTH);
		state.capturedMask?.delete();
		state.capturedMask = null;

		cv.GaussianBlur(
			source,
			blurred,
			new cv.Size(0, 0),
			SHARPEN_SIGMA,
			SHARPEN_SIGMA,
			cv.BORDER_DEFAULT
		);
		cv.addWeighted(source, SHARPEN_AMOUNT, blurred, 1 - SHARPEN_AMOUNT, 0, sharpened, -1);

		ink = inkMask(source);
		const { boxes, thickness } = findComponents(ink);
		const matches = boxes.map((box) => classify(ink!, box, thickness));
		const request = buildRecognition(sharpened.cols, sharpened.rows, boxes, matches);

		const canvas = document.createElement('canvas');
		cv.imshow(canvas, sharpened);
		return { imageDataUrl: await canvasAsPngDataUrl(canvas), request };
	} finally {
		ink?.delete();
		sharpened.delete();
		blurred.delete();
		source.delete();
	}
}
