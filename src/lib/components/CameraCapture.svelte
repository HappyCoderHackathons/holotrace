<script lang="ts">
	import { onDestroy } from 'svelte';
	import { X, SwitchCamera, RotateCcw, Check, Loader2, CameraOff } from 'lucide-svelte';
	import {
		openStream,
		stopStream,
		grabFrame,
		listVideoInputs,
		CameraError
	} from '$lib/camera';

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

	function releasePreview() {
		if (previewUrl) URL.revokeObjectURL(previewUrl);
		previewUrl = null;
		pending = null;
	}

	function teardown() {
		stopStream(stream);
		stream = null;
		releasePreview();
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

	// Opening and closing drives the stream lifecycle, so the camera is never
	// left running behind a closed sheet.
	$effect(() => {
		if (open) {
			start();
		} else {
			teardown();
		}
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
			<button
				class="chrome-icon-btn"
				aria-label="Switch camera"
				disabled={devices.length < 2 || phase === 'captured'}
				onclick={switchCamera}
			>
				<SwitchCamera size={20} />
			</button>
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
				<!--
					Framing guide. Recognition quality depends on the whole sketch
					being in frame, so the affordance earns its place.
				-->
				<div class="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
					<div class="h-full w-full max-h-[80%] max-w-3xl rounded-xl border-2 border-dashed border-white/35"></div>
				</div>
				<p
					class="pointer-events-none absolute inset-x-0 top-3 text-center text-xs font-medium text-white/80"
				>
					Fit the whole sketch inside the frame
				</p>
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
