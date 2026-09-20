import cv, { type Mat } from 'opencv-ts';
import { buildRecognition } from './vision/recognition';
import { gridWindows } from './vision/candidates';
import { locateCircuit } from './vision/circuit';
import { classify } from './vision/classify';
import { findComponents } from './vision/components';
import { inkMask } from './vision/ink';
import { sharpen } from './vision/sharpen';
import { detectScaleFor, state } from './vision/state';
import { windowsWithInk } from './vision/sweep';
import type { OpenCvRecognitionInput } from './recognition';

/**
 * What the first scan knew, kept for the step after the model answers so that step reads exactly the same ink at the
 * same scale. It stays on the device: `recognizeWithModel` sends only the image and the request.
 */
export interface ScanContext {
	/** How much larger the photo is than the detection frame; the crop is in the photo's pixels. */
	detectScale: number;
	/** The ink the boxes were found on (white on black, circuit only), as a PNG data URL. */
	ink: string;
}

export interface PreparedScan extends OpenCvRecognitionInput {
	scan: ScanContext;
}

/** Resolves once OpenCV has finished loading (it starts on first use and takes a moment). */
export function waitForOpenCv(): Promise<void> {
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

/** Reads back the ink saved in a scan as a single-channel mat. The caller frees it. */
export async function inkFromScan(scan: ScanContext): Promise<Mat> {
	await waitForOpenCv();
	const image = await loadImage(scan.ink);
	const rgba = cv.imread(image);
	const ink = new cv.Mat();
	try {
		cv.cvtColor(rgba, ink, cv.COLOR_RGBA2GRAY);
		cv.threshold(ink, ink, 127, 255, cv.THRESH_BINARY);
		return ink;
	} catch (cause) {
		ink.delete();
		throw cause;
	} finally {
		rgba.delete();
	}
}

/** Runs the inexpensive client pass and returns the exact image and pixel-space regions sent to ML. */
export async function prepareRecognitionInput(sourceDataUrl: string): Promise<PreparedScan> {
	await waitForOpenCv();
	const image = await loadImage(sourceDataUrl);
	const photo = cv.imread(image);
	const sharpened = new cv.Mat();
	let cropped: Mat | null = null;
	let ink: Mat | null = null;

	try {
		// Like the live camera stage: find the circuit in the photo and cut it out, so the paper's surroundings (a table,
		// a hand, a face) are not scanned. When no whole circuit is in view the photo is used as it is. Either way
		// state.detectScale and state.capturedMask now describe what is scanned.
		cropped = locateCircuit(photo);
		const source = cropped ?? photo;
		const detectScale = detectScaleFor(photo.cols);
		state.detectScale = detectScale;

		sharpen(source, sharpened);
		ink = inkMask(source);
		const { boxes, thickness } = findComponents(ink);
		const matches = boxes.map((box) => classify(ink!, box, thickness));
		// The sweep: windows over the whole image, for the model to judge, so parts the first pass missed can still be found.
		const sweep = windowsWithInk(ink, gridWindows(sharpened.cols, sharpened.rows));
		const request = buildRecognition(sharpened.cols, sharpened.rows, boxes, matches, sweep);

		const canvas = document.createElement('canvas');
		cv.imshow(canvas, sharpened);
		const inkCanvas = document.createElement('canvas');
		cv.imshow(inkCanvas, ink);
		return {
			imageDataUrl: await canvasAsPngDataUrl(canvas),
			request,
			scan: { detectScale, ink: await canvasAsPngDataUrl(inkCanvas) }
		};
	} finally {
		ink?.delete();
		sharpened.delete();
		cropped?.delete();
		photo.delete();
	}
}
