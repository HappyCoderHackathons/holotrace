<script lang="ts">
	import { onDestroy, untrack } from 'svelte';
	import { X, SwitchCamera, RotateCcw, Check, Loader2, CameraOff } from 'lucide-svelte';
	import {
		openStream,
		stopStream,
		grabFrame,
		listVideoInputs,
		CameraError
	} from '$lib/camera';
	import { HOLD_MS, HOLD_OPEN_MS } from '$lib/vision/config';
	import { HoldMeter } from '$lib/vision/hold';
	import type { LiveCircuit, LiveDetector } from '$lib/liveDetect';

	interface Props {
		open?: boolean;
		/** Receives the captured frame. The caller owns what happens next. */
		onCapture?: (file: File) => void;
		onClose?: () => void;
	}

	let { open = false, onCapture = () => {}, onClose = () => {} }: Props = $props();

	type Phase = 'requesting' | 'live' | 'captured' | 'error';

	let phase = $state<Phase>('requesting');
	let errorMessage = $state('');
	let videoEl = $state<HTMLVideoElement | undefined>();
	let stream: MediaStream | null = null;
	let devices = $state<MediaDeviceInfo[]>([]);
	let deviceIndex = $state(0);

	/** Frozen frame awaiting confirmation, plus its object URL for preview. */
	let pending = $state<File | null>(null);
	let previewUrl = $state<string | null>(null);

	/*
	 * Live detection, as on the dev page: the circuit is looked for in the camera's frames and boxed on screen, and once
	 * it has been held still for long enough the photo is taken on its own. The shutter still works at any time.
	 */
	/** How often a frame is looked at. Detection is the heavy part, so not every frame. */
	const DETECT_EVERY_MS = 120;
	const meter = new HoldMeter();
	let detector: LiveDetector | null = null;
	let detection = $state<'loading' | 'ready' | 'off'>('loading');
	let liveCircuit = $state<LiveCircuit | null>(null);
	let holdProgress = $state(0);
	let videoSize = $state({ width: 0, height: 0 });
	let frameRequest = 0;
	let lastLook = 0;
	let capturing = false;

	function releasePreview() {
		if (previewUrl) URL.revokeObjectURL(previewUrl);
		previewUrl = null;
		pending = null;
	}

	function teardown() {
		// (Also runs while the page is rendered on the server, where there are no animation frames.)
		if (frameRequest) cancelAnimationFrame(frameRequest);
		frameRequest = 0;
		liveCircuit = null;
		holdProgress = 0;
		meter.reset();
		stopStream(stream);
		stream = null;
		releasePreview();
	}

	/** Loads OpenCV and the detector the first time; the camera is usable in the meantime. */
	async function loadDetector() {
		if (detector) {
			detection = 'ready';
			return;
		}
		detection = 'loading';
		try {
			const { LiveDetector } = await import('$lib/liveDetect');
			detector = await LiveDetector.create();
			detection = 'ready';
		} catch {
			detection = 'off';
		}
	}

	function watch(now: number) {
		frameRequest = requestAnimationFrame(watch);
		if (phase !== 'live' || !videoEl || !detector || capturing || now - lastLook < DETECT_EVERY_MS) return;
		lastLook = now;
		try {
			if (videoEl.videoWidth !== videoSize.width || videoEl.videoHeight !== videoSize.height) {
				videoSize = { width: videoEl.videoWidth, height: videoEl.videoHeight };
			}
			const found = detector.detect(videoEl);
			liveCircuit = found;
			// A closed loop is taken after HOLD_MS, any other circuit after the longer HOLD_OPEN_MS (it may be half drawn).
			const holdMs = found?.closed ? HOLD_MS : HOLD_OPEN_MS;
			const fire = meter.track(found?.box ?? null, now, holdMs);
			holdProgress = meter.progress(holdMs);
			if (fire) void autoCapture();
		} catch {
			// Detection failing must not take the camera with it: fall back to the shutter.
			detector = null;
			detection = 'off';
			liveCircuit = null;
			holdProgress = 0;
		}
	}

	/** The circuit held still: take the photo and hand it on, as if it had been taken and accepted. */
	async function autoCapture() {
		if (!videoEl || phase !== 'live' || capturing) return;
		capturing = true;
		try {
			const file = await grabFrame(videoEl);
			teardown();
			onCapture(file);
		} catch (cause) {
			errorMessage = cause instanceof CameraError ? cause.message : 'The photo could not be taken.';
			phase = 'error';
		} finally {
			capturing = false;
		}
	}

	async function start(deviceId?: string) {
		teardown();
		phase = 'requesting';
		errorMessage = '';
		try {
			stream = await openStream(deviceId ? { deviceId } : {});
			// Labels are only populated once permission has been granted, so the
			// device list is worth refreshing after the stream opens.
			devices = await listVideoInputs();
			if (videoEl) {
				videoEl.srcObject = stream;
				await videoEl.play().catch(() => {});
			}
			phase = 'live';
			meter.reset();
			if (frameRequest) cancelAnimationFrame(frameRequest);
			frameRequest = requestAnimationFrame(watch);
			void loadDetector();
		} catch (cause) {
			errorMessage =
				cause instanceof CameraError ? cause.message : 'The camera could not be started.';
			phase = 'error';
		}
	}

	async function shutter() {
		if (!videoEl || phase !== 'live') return;
		try {
			const file = await grabFrame(videoEl);
			releasePreview();
			pending = file;
			previewUrl = URL.createObjectURL(file);
			phase = 'captured';
			// The stream keeps running so Retake is instant rather than
			// re-prompting and re-warming the sensor.
		} catch (cause) {
			errorMessage = cause instanceof CameraError ? cause.message : 'The photo could not be taken.';
			phase = 'error';
		}
	}

	function retake() {
		releasePreview();
		meter.reset();
		phase = stream ? 'live' : 'error';
	}

	function confirm() {
		if (!pending) return;
		const file = pending;
		// Hand off before teardown revokes the preview URL.
		pending = null;
		teardown();
		onCapture(file);
	}

	function close() {
		teardown();
		onClose();
	}

	async function switchCamera() {
		if (devices.length < 2) return;
		deviceIndex = (deviceIndex + 1) % devices.length;
		await start(devices[deviceIndex].deviceId);
	}

	/*
	 * Opening and closing drives the stream lifecycle, so the camera is never
	 * left running behind a closed sheet.
	 *
	 * Only `open` may be a dependency. `start` reaches `releasePreview`, which
	 * reads `previewUrl` and `pending`; without `untrack` those become
	 * dependencies too, so pressing the shutter re-ran this effect and
	 * restarted the camera instead of showing the captured frame.
	 */
	$effect(() => {
		const isOpen = open;
		untrack(() => {
			if (isOpen) start();
			else teardown();
		});
	});

	/*
	 * Backgrounding the app should release the camera. Without this the
	 * indicator light stays on while Holotrace sits behind another window.
	 */
	function handleVisibility() {
		if (document.visibilityState === 'hidden' && open) {
			stopStream(stream);
			stream = null;
			if (phase === 'live') phase = 'requesting';
		} else if (document.visibilityState === 'visible' && open && !stream && phase !== 'captured') {
			start(devices[deviceIndex]?.deviceId);
		}
	}

	onDestroy(teardown);
</script>

<svelte:document onvisibilitychange={handleVisibility} />
<svelte:window
	onkeydown={(e) => {
		if (!open) return;
		if (e.key === 'Escape') close();
	}}
/>

{#if open}
	<div
		class="fixed inset-0 z-modal flex flex-col bg-chrome-950"
		role="dialog"
		aria-modal="true"
		aria-label="Take a photo of your sketch"
	>
		<div class="flex flex-shrink-0 items-center justify-between px-3 py-2 pt-safe">
			<button class="chrome-icon-btn" aria-label="Close camera" onclick={close}>
				<X size={20} />
			</button>
			<span class="text-sm font-medium text-chrome-200">Photograph your sketch</span>
			<!--
				Only shown when there is something to switch to. A desktop with one
				webcam has no second camera, and an always-visible disabled control
				reads as a broken feature rather than an absent one. The empty span
				keeps the title centred.
			-->
			{#if devices.length >= 2}
				<button
					class="chrome-icon-btn"
					aria-label="Switch camera"
					disabled={phase === 'captured'}
					onclick={switchCamera}
				>
					<SwitchCamera size={20} />
				</button>
			{:else}
				<span class="chrome-icon-btn" aria-hidden="true"></span>
			{/if}
		</div>

		<div class="relative min-h-0 flex-1 overflow-hidden bg-black">
			<!-- svelte-ignore a11y_media_has_caption -->
			<video
				bind:this={videoEl}
				class="h-full w-full object-contain"
				class:invisible={phase !== 'live'}
				autoplay
				playsinline
				muted
			></video>

			{#if phase === 'live'}
				{#if liveCircuit && videoSize.width}
					<!--
						The circuit that was found, outlined on the picture. The svg is laid out like the video (both
						fit their box), so the video's own pixels place it. Grey: open circuit, waiting. Yellow: closed
						circuit, waiting. Green: held long enough, being taken.
					-->
					<svg
						class="pointer-events-none absolute inset-0 h-full w-full"
						viewBox={`0 0 ${videoSize.width} ${videoSize.height}`}
						preserveAspectRatio="xMidYMid meet"
						aria-hidden="true"
					>
						<rect
							x={liveCircuit.box.x}
							y={liveCircuit.box.y}
							width={liveCircuit.box.width}
							height={liveCircuit.box.height}
							rx="6"
							fill="none"
							stroke={holdProgress >= 1 ? '#22c55e' : liveCircuit.closed ? '#facc15' : 'rgba(255,255,255,0.65)'}
							stroke-width="3"
							vector-effect="non-scaling-stroke"
						/>
					</svg>
				{:else}
					<!-- Framing guide, until a circuit is found. -->
					<div class="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
						<div class="h-full w-full max-h-[80%] max-w-3xl rounded-xl border-2 border-dashed border-white/35"></div>
					</div>
				{/if}
				<div class="pointer-events-none absolute inset-x-0 top-3 flex justify-center px-4">
					<p
						class="rounded-full bg-black/55 px-3 py-1 text-center text-xs font-medium text-white"
						role="status"
						aria-live="polite"
					>
						{#if !liveCircuit}
							Fit the whole sketch inside the frame
						{:else if liveCircuit.closed}
							Hold still to capture
						{:else}
							Hold still (this looks unfinished, so it waits a little longer)
						{/if}
					</p>
				</div>
				{#if liveCircuit}
					<div class="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
						<div class="h-1.5 w-40 overflow-hidden rounded-full bg-white/25" aria-hidden="true">
							<div class="h-full rounded-full bg-accent" style={`width: ${Math.round(holdProgress * 100)}%`}></div>
						</div>
					</div>
				{:else if detection === 'off'}
					<div class="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center px-4">
						<p class="rounded-full bg-black/55 px-3 py-1 text-center text-[11px] text-white/85">
							Automatic capture is not available here. Use the shutter.
						</p>
					</div>
				{/if}
			{/if}

			{#if phase === 'captured' && previewUrl}
				<img src={previewUrl} alt="Captured sketch, awaiting confirmation" class="absolute inset-0 h-full w-full object-contain" />
			{/if}

			{#if phase === 'requesting'}
				<div class="absolute inset-0 flex flex-col items-center justify-center gap-3" role="status" aria-live="polite">
					<Loader2 size={28} class="animate-spin text-accent-onDark" />
					<p class="text-sm text-chrome-200">Starting the camera…</p>
				</div>
			{/if}

			{#if phase === 'error'}
				<div class="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center" role="alert">
					<CameraOff size={30} class="text-chrome-400" />
					<p class="max-w-sm text-sm leading-relaxed text-chrome-200">{errorMessage}</p>
					<button
						class="mt-1 min-h-touch rounded-lg border border-chrome-600 px-4 text-sm font-medium text-chrome-100 hover:bg-chrome-800"
						onclick={() => start(devices[deviceIndex]?.deviceId)}
					>
						Try again
					</button>
				</div>
			{/if}
		</div>

		<div class="flex flex-shrink-0 items-center justify-center gap-6 px-6 py-5 pb-safe">
			{#if phase === 'captured'}
				<button
					class="flex min-h-touch items-center gap-2 rounded-xl border border-chrome-600 px-5 text-sm font-semibold text-chrome-100 hover:bg-chrome-800"
					onclick={retake}
				>
					<RotateCcw size={17} />
					Retake
				</button>
				<button
					class="flex min-h-touch items-center gap-2 rounded-xl bg-accent px-5 text-sm font-semibold text-white hover:bg-accent-hover"
					onclick={confirm}
				>
					<Check size={17} />
					Use photo
				</button>
			{:else}
				<button
					class="h-16 w-16 rounded-full border-4 border-white/85 bg-white/15 transition-transform active:scale-95 disabled:opacity-40"
					aria-label="Take photo"
					disabled={phase !== 'live'}
					onclick={shutter}
				>
					<span class="mx-auto block h-11 w-11 rounded-full bg-white"></span>
				</button>
			{/if}
		</div>
	</div>
{/if}
