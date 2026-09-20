<script lang="ts">
	import { CircuitBoard, FileText, Table2 } from 'lucide-svelte';
	import { viewMode } from '$lib/stores/circuit';
	import type { ViewMode } from '$lib/types';

	const tabs: { id: ViewMode; label: string; icon: typeof CircuitBoard }[] = [
		{ id: 'circuit', label: 'Circuit', icon: CircuitBoard },
		{ id: 'schematic', label: 'Schematic', icon: FileText },
		{ id: 'components', label: 'Parts list', icon: Table2 }
	];
</script>

<nav
	class="flex flex-shrink-0 items-stretch justify-around border-t border-chrome-600 bg-chrome-800 pb-safe"
	aria-label="View"
>
	{#each tabs as tab (tab.id)}
		{@const active = $viewMode === tab.id}
		<button
			class="flex min-h-touch flex-1 flex-col items-center justify-center gap-1 pt-2 transition-colors"
			class:text-accent-onDark={active}
			class:text-chrome-300={!active}
			aria-current={active ? 'page' : undefined}
			onclick={() => viewMode.set(tab.id)}
		>
			<tab.icon size={19} strokeWidth={active ? 2.25 : 1.75} />
			<span class="text-[10px]" class:font-semibold={active}>{tab.label}</span>
		</button>
	{/each}
</nav>
