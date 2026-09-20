/**
 * Camera access for sketch capture. Kept free of Svelte so the capture
 * mechanics can be reasoned about, and changed, independently of the UI that
 * drives them.
 *
 * Captured frames are treated as sensitive: they exist only as an in-memory
 * `File` handed to the recognition pipeline, are never written to disk, and
 * are never logged.
 */

export type CameraErrorKind =
	| 'denied'
	| 'no-device'
	| 'insecure-context'
	| 'in-use'
	| 'unavailable';

export class CameraError extends Error {
	constructor(
		readonly kind: CameraErrorKind,
		message: string
	) {
		super(message);
		this.name = 'CameraError';
	}
}

const MESSAGES: Record<CameraErrorKind, string> = {
	denied: 'Camera access was blocked. Allow it for Holotrace, then try again.',
	'no-device': 'No camera was found on this device.',
	'insecure-context':
		'The camera needs a secure context. Use the app, or open this page over HTTPS or on localhost.',
	'in-use': 'The camera is already in use by another app.',
	unavailable: 'The camera could not be started.'
};

/** getUserMedia only exists in a secure context, so absence is not a failure. */
export function isCameraSupported(): boolean {
	return (
		typeof navigator !== 'undefined' &&
		typeof navigator.mediaDevices?.getUserMedia === 'function'
	);
}

/**
 * Whether a camera is actually present. This, not the pointer type, is what
 * should decide if a capture affordance is offered: a desktop with a webcam
 * can capture, and a touch screen without a camera cannot.
 *
 * Before permission is granted, `enumerateDevices` reports video inputs with
 * empty labels, so this detects presence without prompting.
 */
export async function hasVideoInput(): Promise<boolean> {
	if (!isCameraSupported() || typeof navigator.mediaDevices.enumerateDevices !== 'function') {
		return false;
	}
	try {
		const devices = await navigator.mediaDevices.enumerateDevices();
		return devices.some((d) => d.kind === 'videoinput');
	} catch {
		return false;
	}
}

export async function listVideoInputs(): Promise<MediaDeviceInfo[]> {
	if (!isCameraSupported()) return [];
	try {
		const devices = await navigator.mediaDevices.enumerateDevices();
		return devices.filter((d) => d.kind === 'videoinput');
	} catch {
		return [];
	}
}

function toCameraError(cause: unknown): CameraError {
	const name = typeof cause === 'object' && cause && 'name' in cause ? String(cause.name) : '';
	switch (name) {
		case 'NotAllowedError':
		case 'SecurityError':
			return new CameraError('denied', MESSAGES.denied);
		case 'NotFoundError':
		case 'OverconstrainedError':
			return new CameraError('no-device', MESSAGES['no-device']);
		case 'NotReadableError':
		case 'AbortError':
			return new CameraError('in-use', MESSAGES['in-use']);
		default:
			return new CameraError('unavailable', MESSAGES.unavailable);
	}
}

export interface OpenStreamOptions {
	/** Pin to a specific camera, from `listVideoInputs`. */
	deviceId?: string;
}

/**
 * Open a capture stream, preferring the rear camera and a high enough
 * resolution to read pencil on paper. Both are requested as non-binding
 * `ideal` constraints so a laptop webcam, which has neither, still opens.
 */
export async function openStream(options: OpenStreamOptions = {}): Promise<MediaStream> {
	if (typeof window !== 'undefined' && !window.isSecureContext) {
		throw new CameraError('insecure-context', MESSAGES['insecure-context']);
	}
	if (!isCameraSupported()) {
		throw new CameraError('unavailable', MESSAGES.unavailable);
	}

	const video: MediaTrackConstraints = {
		width: { ideal: 1920 },
		height: { ideal: 1080 }
	};
	if (options.deviceId) {
		video.deviceId = { exact: options.deviceId };
	} else {
		video.facingMode = { ideal: 'environment' };
	}

	try {
		return await navigator.mediaDevices.getUserMedia({ video, audio: false });
	} catch (cause) {
		throw toCameraError(cause);
	}
}

/**
 * Release the camera. Worth being strict about: until every track is stopped
 * the device indicator light stays on, which reads as the app still watching.
 */
export function stopStream(stream: MediaStream | null | undefined): void {
	stream?.getTracks().forEach((track) => track.stop());
}

/**
 * Copy the current video frame into a JPEG `File` at the sensor's own
 * resolution. Downscaling here would throw away detail the recognition pass
 * depends on, so the frame is taken at full size and left for the pipeline
 * to reduce.
 */
export async function grabFrame(video: HTMLVideoElement, filename = 'sketch.jpg'): Promise<File> {
	const width = video.videoWidth;
	const height = video.videoHeight;
	if (!width || !height) {
		throw new CameraError('unavailable', 'The camera is not ready yet. Try again in a moment.');
	}

	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext('2d');
	if (!ctx) {
		throw new CameraError('unavailable', MESSAGES.unavailable);
	}
	ctx.drawImage(video, 0, 0, width, height);

	const blob = await new Promise<Blob | null>((resolve) =>
		canvas.toBlob(resolve, 'image/jpeg', 0.92)
	);
	if (!blob) {
		throw new CameraError('unavailable', 'The photo could not be encoded.');
	}

	return new File([blob], filename, { type: 'image/jpeg', lastModified: Date.now() });
}
