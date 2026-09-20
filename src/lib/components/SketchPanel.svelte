<script lang="ts">
	import { ImageUp, CheckCircle2, Camera } from 'lucide-svelte';
	import { circuit } from '$lib/stores/circuit';
	import { canOfferCapture } from '$lib/camera';

	interface Props {
		onUploadClick?: () => void;
	}

	let { onUploadClick = () => {} }: Props = $props();

	/** Mirrors UploadModal: the affordance follows the camera, not the pointer. */
	let cameraAvailable = $state(false);
	$effect(() => {
		canOfferCapture().then((available) => (cameraAvailable = available));
	});

	const detection = $derived($circuit.detection);
	const componentCount = $derived($circuit.components.length);
	const wireCount = $derived($circuit.wires.length);
</script>

<div class="space-y-4 py-1">
	<button
		class="group relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-xl border border-dashed border-chrome-500 bg-chrome-900 transition-colors hover:border-accent"
		onclick={onUploadClick}
		data-autofocus
	>
		{#if detection.sourceImage}
			<img
				src={detection.sourceImage}
				alt="Uploaded hand-drawn circuit sketch"
				class="h-full w-full object-cover"
			/>
			<div
				class="absolute inset-0 flex items-center justify-center bg-ink-900/0 opacity-0 transition-opacity group-hover:bg-ink-900/50 group-hover:opacity-100"
			>
				<span class="rounded-md bg-chrome-100 px-2.5 py-1 text-xs font-medium text-ink-900">
					Replace sketch
				</span>
			</div>
		{:else}
			<div class="flex flex-col items-center gap-2 px-4 text-center text-chrome-400">
				{#if cameraAvailable}
					<Camera size={26} />
					<span class="text-xs font-medium text-chrome-300">Photograph a sketch</span>
				{:else}
					<ImageUp size={26} />
					<span class="text-xs font-medium text-chrome-300">Upload a sketch</span>
				{/if}
				<span class="text-[11px] leading-snug text-chrome-400">
					Holotrace reads the components and wiring
				</span>
			</div>
		{/if}
	</button>

	{#if detection.sourceImage}
		<div class="flex items-start gap-2 rounded-lg border border-signal-current/25 bg-signal-current/10 px-3 py-2.5">
			<CheckCircle2 size={15} class="mt-0.5 flex-shrink-0 text-signal-current" />
			<p class="text-xs leading-snug text-chrome-200">{detection.status}</p>
		</div>
	{/if}

	<div class="rounded-lg border border-chrome-600 bg-chrome-900 p-3">
		<dl class="space-y-2 text-xs">
			<div class="flex justify-between">
				<dt class="text-chrome-300">Components</dt>
				<dd class="font-mono font-semibold text-accent-onDark">{componentCount}</dd>
			</div>
			<div class="flex justify-between">
				<dt class="text-chrome-300">Connections</dt>
				<dd class="font-mono font-semibold text-accent-onDark">{wireCount}</dd>
			</div>
			<div class="flex justify-between">
				<dt class="text-chrome-300">Detected</dt>
				<dd class="font-mono text-chrome-200">
					{detection.detectedAt ? new Date(detection.detectedAt).toLocaleTimeString() : '—'}
				</dd>
			</div>
		</dl>
	</div>

	<button
		class="w-full rounded-lg border border-chrome-600 py-2.5 text-xs font-medium text-chrome-200 transition-colors hover:bg-chrome-700"
		onclick={onUploadClick}
	>
		{detection.sourceImage ? 'Use a different sketch' : 'Browse for an image'}
	</button>
</div>
