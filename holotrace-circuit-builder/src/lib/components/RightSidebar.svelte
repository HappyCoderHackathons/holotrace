<script lang="ts">
	import { ChevronLeft, ChevronRight, Search, List } from 'lucide-svelte';
	import { rightSidebarOpen, addComponent } from '$lib/stores/circuit';
	import { PALETTE } from '$lib/componentLibrary';
	import ComponentGlyph from './ComponentGlyph.svelte';

	let query = '';
	let category: 'All' | 'Basic' | 'Power' | 'Input' = 'All';

	const categories: ('All' | 'Basic' | 'Power' | 'Input')[] = ['All', 'Basic', 'Power', 'Input'];

	$: filtered = PALETTE.filter((item) => {
		const matchesCategory = category === 'All' || item.category === category;
		const matchesQuery = item.label.toLowerCase().includes(query.toLowerCase());
		return matchesCategory && matchesQuery;
	});

	function handleDragStart(e: DragEvent, type: string) {
		e.dataTransfer?.setData('component-type', type);
	}

	function handlePaletteClick(type: (typeof PALETTE)[number]['type']) {
		addComponent(type, 460 + Math.random() * 40, 260 + Math.random() * 40);
	}
</script>

{#if $rightSidebarOpen}
	<aside class="flex w-72 flex-shrink-0 flex-col border-l border-surface-200 bg-white">
		<div class="flex items-center justify-between border-b border-surface-200 px-4 py-3">
			<div class="flex items-center gap-2">
				<button
					class="rounded p-1 text-ink-500 hover:bg-surface-100"
					aria-label="Collapse palette"
					on:click={() => rightSidebarOpen.set(false)}
				>
					<ChevronRight size={16} />
				</button>
				<span class="text-sm font-semibold text-ink-900">Components</span>
			</div>
			<List size={16} class="text-ink-300" />
		</div>

		<div class="border-b border-surface-200 p-3">
			<div class="relative">
				<Search size={14} class="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-300" />
				<input
					bind:value={query}
					type="text"
					placeholder="Search"
					class="w-full rounded-md border border-surface-200 bg-surface-50 py-1.5 pl-8 pr-2 text-sm text-ink-900 placeholder:text-ink-300 focus:border-accent focus:outline-none"
				/>
			</div>
			<div class="mt-2 flex gap-1">
				{#each categories as cat}
					<button
						class="rounded-md px-2.5 py-1 text-xs font-medium"
						class:bg-accent-light={category === cat}
						class:text-accent={category === cat}
						class:text-ink-500={category !== cat}
						on:click={() => (category = cat)}
					>
						{cat}
					</button>
				{/each}
			</div>
		</div>

		<div class="thin-scroll flex-1 overflow-y-auto p-3">
			<div class="grid grid-cols-2 gap-2">
				{#each filtered as item}
					<button
						draggable="true"
						on:dragstart={(e) => handleDragStart(e, item.type)}
						on:click={() => handlePaletteClick(item.type)}
						class="flex flex-col items-center gap-1.5 rounded-lg border border-surface-200 bg-white p-3 hover:border-accent hover:shadow-panel active:cursor-grabbing"
					>
						<svg viewBox="-32 -20 64 40" class="h-9 w-14">
							<ComponentGlyph type={item.type} color={item.defaultColor} scale={0.85} />
						</svg>
						<span class="text-[11px] font-medium leading-tight text-ink-700">{item.label}</span>
					</button>
				{/each}
			</div>
			{#if filtered.length === 0}
				<p class="mt-6 text-center text-xs text-ink-300">No components match "{query}"</p>
			{/if}
		</div>
	</aside>
{:else}
	<button
		class="flex w-8 flex-shrink-0 items-center justify-center border-l border-surface-200 bg-white hover:bg-surface-100"
		aria-label="Expand palette"
		on:click={() => rightSidebarOpen.set(true)}
	>
		<ChevronLeft size={16} class="text-ink-500" />
	</button>
{/if}
