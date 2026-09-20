<script lang="ts">
	import { X, ImageUp, Loader2, ScanLine, AlertTriangle, Camera } from 'lucide-svelte';
	import { readFileAsDataUrl, parseSketch } from '$lib/sketchParser';
	import { loadDetectedCircuit } from '$lib/stores/circuit';
	import { isCompact, isCoarsePointer } from '$lib/stores/ui';

	interface Props {
		open?: boolean;
		onClose?: () => void;
	}

	let { open = false, onClose = () => {} }: Props = $props();

	let fileInput = $state<HTMLInputElement | undefined>();
	let cameraInput = $state<HTMLInputElement | undefined>();
	let processing = $state(false);
	let dragOver = $state(false);
	let error = $state<string | null>(null);

	async function handleFile(file: File | undefined | null) {
		if (!file || processing) return;
		if (!file.type.startsWith('image/')) {
			error = 'That file is not an image. Upload a JPG or PNG photo of your sketch.';
			return;
		}

		error = null;
		processing = true;
		try {
			const dataUrl = await readFileAsDataUrl(file);
			loadDetectedCircuit(await parseSketch(dataUrl));
			close();
		} catch {
			// Keep the dialog open so the capture is not silently discarded.
			error = 'Could not read that sketch. Check the file and try again.';
		} finally {
			processing = false;
		}
	}

	function close() {
		if (processing) return;
		error = null;
		if (fileInput) fileInput.value = '';
		if (cameraInput) cameraInput.value = '';
		onClose();
	}
</script>

<svelte:window
	onkeydown={(e) => {
		if (open && e.key === 'Escape') close();
	}}
/>

{#if open}
	<div
		class="fixed inset-0 z-modal flex bg-ink-900/50 backdrop-blur-[2px]"
		class:items-end={$isCompact}
		class:items-center={!$isCompact}
		class:justify-center={true}
		class:p-4={!$isCompact}
		role="presentation"
		onclick={(e) => {
			if (e.target === e.currentTarget) close();
		}}
	>
		<!-- Full-width sheet on a phone, centred dialog on a larger screen. -->
		<div
			class="w-full border-chrome-600 bg-chrome-800 shadow-raised"
			class:max-w-md={!$isCompact}
			class:rounded-xl={!$isCompact}
			class:border={!$isCompact}
			class:rounded-t-2xl={$isCompact}
			class:border-t={$isCompact}
			class:pb-safe={$isCompact}
			role="dialog"
			aria-modal="true"
			aria-labelledby="upload-modal-title"
		>
			<div class="flex items-center justify-between border-b border-chrome-600 px-5 py-4">
				<h2 id="upload-modal-title" class="text-sm font-semibold text-chrome-100">
					Add a circuit sketch
				</h2>
				<button
					class="chrome-icon-btn"
					disabled={processing}
					onclick={close}
					aria-label="Close"
				>
					<X size={18} />
				</button>
			</div>

			<div class="p-5">
				{#if processing}
					<div
						class="flex flex-col items-center justify-center gap-3 rounded-xl border border-chrome-600 bg-chrome-900 py-12"
						role="status"
						aria-live="polite"
					>
						<Loader2 size={28} class="animate-spin text-accent-onDark" />
						<p class="text-sm font-medium text-chrome-100">Detecting components…</p>
						<p class="text-xs text-chrome-400">Parsing your sketch into a digital circuit</p>
					</div>
				{:else}
					{#if $isCoarsePointer}
						<!--
							On a phone the camera is the primary path: the product starts with
							photographing a sketch, not with browsing a filesystem.
						-->
						<button
							class="flex min-h-touch w-full items-center justify-center gap-2 rounded-xl bg-accent py-3.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
							onclick={() => cameraInput?.click()}
						>
							<Camera size={18} />
							Take a photo
						</button>
						<input
							bind:this={cameraInput}
							type="file"
							accept="image/*"
							capture="environment"
							class="hidden"
							onchange={(e) => handleFile(e.currentTarget.files?.[0])}
						/>

						<div class="my-3 flex items-center gap-3 text-[11px] uppercase tracking-wide text-chrome-400">
							<span class="h-px flex-1 bg-chrome-600"></span>
							or
							<span class="h-px flex-1 bg-chrome-600"></span>
						</div>
					{/if}

					<button
						class="flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed transition-colors"
						class:py-8={$isCoarsePointer}
						class:py-12={!$isCoarsePointer}
						class:border-accent={dragOver}
						class:bg-accent-subtle={dragOver}
						class:border-chrome-500={!dragOver}
						onclick={() => fileInput?.click()}
						ondragover={(e) => {
							e.preventDefault();
							dragOver = true;
						}}
						ondragleave={() => (dragOver = false)}
						ondrop={(e) => {
							e.preventDefault();
							dragOver = false;
							handleFile(e.dataTransfer?.files?.[0]);
						}}
					>
						<ImageUp size={28} class="text-chrome-400" />
						<div class="px-4 text-center">
							<p class="text-sm font-medium text-chrome-100">
								{$isCoarsePointer ? 'Choose an existing photo' : 'Drop a photo or click to browse'}
							</p>
							<p class="mt-1 text-xs text-chrome-400">Hand-drawn sketch of your circuit, JPG or PNG</p>
						</div>
					</button>
					<input
						bind:this={fileInput}
						type="file"
						accept="image/*"
						class="hidden"
						onchange={(e) => handleFile(e.currentTarget.files?.[0])}
					/>

					{#if error}
						<div
							class="mt-4 flex items-start gap-2 rounded-lg border border-signal-danger/30 bg-signal-danger/10 px-3 py-2.5"
							role="alert"
						>
							<AlertTriangle size={14} class="mt-0.5 flex-shrink-0 text-signal-danger" />
							<p class="text-xs leading-snug text-chrome-100">{error}</p>
						</div>
					{/if}

					<div class="mt-4 flex items-start gap-2 rounded-lg bg-chrome-900 px-3 py-2.5">
						<ScanLine size={14} class="mt-0.5 flex-shrink-0 text-chrome-400" />
						<p class="text-xs leading-snug text-chrome-300">
							Holotrace detects the components and wiring, then builds an editable circuit you can
							simulate.
						</p>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
