import { invoke } from '@tauri-apps/api/core';
import type { OpenCvRecognitionInput, RecognitionResult } from './recognition';

/** Sends OpenCV output through Rust so the bearer credential never enters the webview. */
export async function recognizeWithModel(input: OpenCvRecognitionInput): Promise<RecognitionResult> {
	if (!('__TAURI_INTERNALS__' in window)) {
		throw new Error('Model recognition requires the Holotrace desktop or mobile app.');
	}
	try {
		// Only the image and the request go to the native side (it rejects anything else); a prepared scan's own
		// notes (`scan`) stay on the device.
		const { imageDataUrl, request } = input;
		return await invoke<RecognitionResult>('recognize_circuit', { input: { imageDataUrl, request } });
	} catch (cause) {
		if (typeof cause === 'object' && cause !== null && 'message' in cause) {
			throw new Error(String(cause.message));
		}
		throw new Error(typeof cause === 'string' ? cause : 'The model request failed.');
	}
}
