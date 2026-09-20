<script lang="ts">
	import { FilePlus2, Share2, Upload } from 'lucide-svelte';
	import { downloadDiagram, importDiagramFile } from '$lib/diagramFiles';
	import { newCircuit } from '$lib/stores/circuit';

	interface Props {
		/** One button per row, for the mobile sheet. */
		stacked?: boolean;
	}

	let { stacked = false }: Props = $props();

	let fileInput = $state<HTMLInputElement | undefined>();

	async function pick(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (file) await importDiagramFile(file);
	}

	const button =
		'flex items-center justify-center gap-1.5 rounded-lg border border-chrome-600 px-3.5 py-2 text-sm font-medium text-chrome-200 transition-colors hover:bg-chrome-700';
</script>

<div class={stacked ? 'flex flex-col gap-1.5' : 'flex items-center gap-2'}>
	<button class={button} onclick={newCircuit} aria-label="New circuit">
		<FilePlus2 size={14} />
		New
	</button>
	<button class={button} onclick={() => fileInput?.click()} aria-label="Import a diagram file">
		<Upload size={14} />
		Import
	</button>
	<button class={button} onclick={downloadDiagram} aria-label="Export the circuit as a diagram file">
		<Share2 size={14} />
		Export
	</button>
	<input
		bind:this={fileInput}
		type="file"
		accept=".json,application/json"
		class="hidden"
		onchange={pick}
	/>
</div>
