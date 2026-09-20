import cv, { type Mat } from 'opencv-ts';
import { DETECT_WIDTH, SHARPEN_AMOUNT, SHARPEN_SIGMA } from "./vision/config";
import { buildRecognition } from "./vision/recognition";
import { gridWindows } from "./vision/candidates";
import { windowsWithInk } from "./vision/sweep";
import { locateCircuit } from "./vision/circuit";
import { state } from "./vision/state";
import { classify } from "./vision/classify";
import { findComponents } from "./vision/components";
import { inkMask } from "./vision/ink";
import type { OpenCvRecognitionInput } from "./recognition";

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

/**
 * The stroke scale each prepared capture was scanned at, so the later steps (tracing the wires) read the same ink.
 * It comes from the whole photo, not the crop, as it does on the dev page.
 */
const scans = new WeakMap<OpenCvRecognitionInput, number>();
export const detectScaleOf = (input: OpenCvRecognitionInput): number | undefined => scans.get(input);

/** Runs the inexpensive client pass and returns the exact image and pixel-space regions sent to ML. */
export async function prepareRecognitionInput(sourceDataUrl: string): Promise<OpenCvRecognitionInput> {
	await waitForOpenCv();
	const image = await loadImage(sourceDataUrl);
	const photo = cv.imread(image);
	// Like the live camera stage: find the circuit in the photo and cut it out, so the paper's surroundings (a table,
	// a hand, a face) are not scanned. When no whole circuit is in view the photo is used as it is.
	const cropped = locateCircuit(photo);
	const source = cropped ?? photo;
	const blurred = new cv.Mat();
	const sharpened = new cv.Mat();
	let ink: Mat | null = null;

	try {
		if (cropped === null) {
			state.detectScale = Math.max(1, source.cols / DETECT_WIDTH);
			state.capturedMask?.delete();
			state.capturedMask = null;
		}
		const detectScale = state.detectScale;

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
		// The sweep: windows over the whole image, for the model to judge, so parts the first pass missed can still be found.
		const sweep = windowsWithInk(ink, gridWindows(sharpened.cols, sharpened.rows));
		const request = buildRecognition(sharpened.cols, sharpened.rows, boxes, matches, sweep);

		const canvas = document.createElement('canvas');
		cv.imshow(canvas, sharpened);
		const input = { imageDataUrl: await canvasAsPngDataUrl(canvas), request };
		scans.set(input, detectScale);
		return input;
	} finally {
		ink?.delete();
		sharpened.delete();
		blurred.delete();
		source.delete();
		if (cropped !== null) photo.delete();
	}
}
