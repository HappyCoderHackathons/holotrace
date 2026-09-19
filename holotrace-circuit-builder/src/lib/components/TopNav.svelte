<script lang="ts">
	import { Cpu, Share2 } from 'lucide-svelte';
	import { viewMode } from '$lib/stores/circuit';
	import type { ViewMode } from '$lib/types';

	const tabs: { id: ViewMode; label: string }[] = [
		{ id: 'circuit', label: 'Circuit View' },
		{ id: 'schematic', label: 'Schematic View' },
		{ id: 'components', label: 'Components' }
	];

	export let onExport: () => void = () => {};
</script>

<header class="flex h-14 flex-shrink-0 items-center justify-between border-b border-surface-200 bg-white px-4">
	<div class="flex items-center gap-2">
		<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white">
			<Cpu size={18} strokeWidth={2.25} />
		</div>
		<span class="text-[15px] font-semibold text-ink-900">Holotrace</span>
	</div>

	<nav class="absolute left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-lg bg-surface-100 p-1">
		{#each tabs as tab}
			<button
				class="rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors"
				class:bg-white={$viewMode === tab.id}
				class:text-accent={$viewMode === tab.id}
				class:shadow-panel={$viewMode === tab.id}
				class:text-ink-500={$viewMode !== tab.id}
				on:click={() => viewMode.set(tab.id)}
			>
				{tab.label}
			</button>
		{/each}
	</nav>

	<div class="flex items-center gap-2">
		<button
			class="flex items-center gap-1.5 rounded-lg border border-surface-200 px-3.5 py-2 text-sm font-medium text-ink-700 hover:bg-surface-100"
			on:click={onExport}
		>
			<Share2 size={14} />
			Export / Share
		</button>
	</div>
</header>
