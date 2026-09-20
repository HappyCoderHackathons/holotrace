<script lang="ts">
	import { onMount } from 'svelte';
	import { Download } from 'lucide-svelte';
	import Canvas from './Canvas.svelte';
	import { canvasZoom, canvasPan } from '$lib/stores/circuit';

	onMount(() => {
		canvasZoom.set(0.8);
		canvasPan.set({ x: 80, y: 24 });
		return () => {
			canvasZoom.set(1);
			canvasPan.set({ x: 0, y: 0 });
		};
	});

	const cols = ['1', '2', '3', '4', '5', '6'];
	const rows = ['A', 'B', 'C', 'D', 'E'];
</script>

<div class="flex min-h-0 h-full flex-col overflow-hidden bg-surface-50">
	<div class="flex items-center justify-between border-b border-surface-200 bg-white px-6 py-3">
		<h2 class="text-sm font-semibold text-ink-300">Schematic View</h2>
		<button
			class="flex items-center gap-2 rounded-lg border border-surface-200 px-3.5 py-2 text-sm font-medium text-ink-700 hover:bg-surface-100"
		>
			<Download size={15} />
			Download .PDF
		</button>
	</div>

	<div class="min-h-0 flex-1 overflow-hidden p-4 sm:p-6">
		<div class="relative mx-auto flex h-full min-h-0 w-full max-w-5xl flex-col border-2 border-schematic bg-white">
			<div class="grid grid-cols-6 border-b border-schematic text-center text-xs font-medium text-schematic">
				{#each cols as c (c)}
					<div class="border-r border-schematic py-1 last:border-r-0">{c}</div>
				{/each}
			</div>
			<div class="relative flex min-h-0 flex-1">
				<div class="flex w-6 shrink-0 flex-col text-xs font-medium text-schematic">
					{#each rows as r (r)}
						<div class="flex flex-1 items-center justify-center border-r border-schematic">{r}</div>
					{/each}
				</div>
				<div class="relative min-h-0 min-w-0 flex-1">
					<Canvas editable={false} showGrid={false} schematic={true} />
				</div>
			</div>
			<div class="flex items-center justify-between border-t border-schematic px-4 py-2 text-xs text-schematic">
				<span>Made with Holotrace</span>
				<div class="flex gap-6">
					<span>Title: <strong class="font-semibold">Detected Circuit</strong></span>
					<span>Sheet: 1/1</span>
				</div>
			</div>
		</div>
	</div>
</div>
