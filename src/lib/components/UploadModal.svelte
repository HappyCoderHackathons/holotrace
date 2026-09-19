<script lang="ts">
	import { X, ImageUp, Loader2, ScanLine, AlertTriangle } from 'lucide-svelte';
	import { readFileAsDataUrl, parseSketch } from '$lib/sketchParser';
	import { loadDetectedCircuit } from '$lib/stores/circuit';

	interface Props {
		open?: boolean;
		onClose?: () => void;
	}

	let { open = false, onClose = () => {} }: Props = $props();

	let fileInput = $state<HTMLInputElement | undefined>();
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
		class="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4"
		role="presentation"
		onclick={(e) => {
			if (e.target === e.currentTarget) close();
		}}
	>
		<div
			class="w-full max-w-md rounded-xl bg-white shadow-xl"
			role="dialog"
			aria-modal="true"
			aria-labelledby="upload-modal-title"
		>
			<div class="flex items-center justify-between border-b border-surface-200 px-5 py-4">
				<h2 id="upload-modal-title" class="text-sm font-semibold text-ink-900">
					Upload circuit sketch
				</h2>
				<button
					class="rounded p-1 text-ink-500 hover:bg-surface-100 disabled:opacity-30"
					disabled={processing}
					onclick={close}
					aria-label="Close"
				>
					<X size={18} />
				</button>
			</div>

			<div class="p-5">
				{#if processing}
					<div class="flex flex-col items-center justify-center gap-3 rounded-lg border border-surface-200 bg-surface-50 py-12">
						<Loader2 size={28} class="animate-spin text-accent" />
						<p class="text-sm font-medium text-ink-700">Detecting components…</p>
						<p class="text-xs text-ink-300">Parsing sketch into a digital circuit</p>
					</div>
				{:else}
					<button
						class="flex w-full flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed py-12 transition-colors"
						class:border-accent={dragOver}
						class:bg-accent-light={dragOver}
						class:border-surface-300={!dragOver}
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
						<ImageUp size={30} class="text-ink-300" />
						<div class="text-center">
							<p class="text-sm font-medium text-ink-900">Drop a photo or click to browse</p>
							<p class="mt-1 text-xs text-ink-300">Hand-drawn sketch of your circuit (JPG, PNG)</p>
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
						<div class="mt-4 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5" role="alert">
							<AlertTriangle size={14} class="mt-0.5 flex-shrink-0 text-red-600" />
							<p class="text-xs leading-snug text-red-700">{error}</p>
						</div>
					{/if}

					<div class="mt-4 flex items-start gap-2 rounded-lg bg-surface-50 px-3 py-2.5">
						<ScanLine size={14} class="mt-0.5 flex-shrink-0 text-ink-300" />
						<p class="text-xs leading-snug text-ink-500">
							Holotrace will detect components and wiring, then generate an editable digital
							circuit you can simulate.
						</p>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
