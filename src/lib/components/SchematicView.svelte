<script lang="ts">
	import { Download } from 'lucide-svelte';
	import Canvas from './Canvas.svelte';

	const cols = ['1', '2', '3', '4', '5', '6'];
	const rows = ['A', 'B', 'C', 'D', 'E'];
</script>

<div class="flex h-full min-h-0 flex-col overflow-hidden bg-chrome-900">
	<div class="flex flex-shrink-0 items-center justify-between gap-3 border-b border-chrome-600 px-4 py-3 sm:px-6">
		<h2 class="text-sm font-semibold text-chrome-100">Schematic</h2>
		<button
			class="flex min-h-touch items-center gap-2 rounded-lg border border-chrome-600 px-3.5 text-sm font-medium text-chrome-200 transition-colors hover:bg-chrome-700"
		>
			<Download size={15} />
			<span class="hidden sm:inline">Download</span> PDF
		</button>
	</div>

	<div class="min-h-0 flex-1 overflow-hidden p-2 sm:p-6">
		<div
			class="relative mx-auto flex h-full min-h-0 w-full max-w-5xl flex-col border-2 border-signal-schematic bg-canvas-raised"
		>
			<!-- Sheet reference borders are print furniture, so they stay hidden on a phone. -->
			<div
				class="hidden grid-cols-6 border-b border-signal-schematic text-center text-xs font-medium text-signal-schematic sm:grid"
			>
				{#each cols as c (c)}
					<div class="border-r border-signal-schematic py-1 last:border-r-0">{c}</div>
				{/each}
			</div>
			<div class="relative flex min-h-0 flex-1">
				<div
					class="hidden w-6 shrink-0 flex-col text-xs font-medium text-signal-schematic sm:flex"
				>
					{#each rows as r (r)}
						<div class="flex flex-1 items-center justify-center border-r border-signal-schematic">
							{r}
						</div>
					{/each}
				</div>
				<div class="relative min-h-0 min-w-0 flex-1">
					<Canvas editable={false} showGrid={false} schematic={true} />
				</div>
			</div>
			<div
				class="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-t border-signal-schematic px-3 py-2 text-[11px] text-signal-schematic sm:px-4 sm:text-xs"
			>
				<span>Made with Holotrace</span>
				<div class="flex gap-4 sm:gap-6">
					<span>Title: <strong class="font-semibold">Detected Circuit</strong></span>
					<span>Sheet: 1/1</span>
				</div>
			</div>
		</div>
	</div>
</div>
