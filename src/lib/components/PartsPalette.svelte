<script lang="ts">
	import { Search, SearchX } from 'lucide-svelte';
	import { get } from 'svelte/store';
	import { addComponent, viewCentre } from '$lib/stores/circuit';
	import { PALETTE, type PaletteItem } from '$lib/componentLibrary';
	import type { ComponentType } from '$lib/types';
	import ComponentGlyph from './ComponentGlyph.svelte';

	type Category = 'All' | PaletteItem['category'];

	interface Props {
		/** Compact layouts use wider tiles and place at canvas centre. */
		compact?: boolean;
		onPlaced?: () => void;
	}

	let { compact = false, onPlaced = () => {} }: Props = $props();

	const categories: Category[] = ['All', 'Basic', 'Power', 'Input', 'Logic', 'Other'];

	let query = $state('');
	let category = $state<Category>('All');

	const filtered = $derived(
		PALETTE.filter((item) => {
			const matchesCategory = category === 'All' || item.category === category;
			const matchesQuery = item.label.toLowerCase().includes(query.toLowerCase());
			return matchesCategory && matchesQuery;
		})
	);

	function handleDragStart(e: DragEvent, type: ComponentType) {
		e.dataTransfer?.setData('component-type', type);
	}

	function place(type: ComponentType) {
		// Scatter slightly so repeated taps do not stack components exactly.
		const centre = get(viewCentre);
		addComponent(type, centre.x + (Math.random() - 0.5) * 40, centre.y + (Math.random() - 0.5) * 40);
		onPlaced();
	}
</script>

<div class="flex min-h-0 flex-col">
	<div class="space-y-2 pb-3">
		<div class="relative">
			<Search size={14} class="absolute left-2.5 top-1/2 -translate-y-1/2 text-chrome-400" />
			<input
				bind:value={query}
				type="text"
				placeholder="Search components"
				aria-label="Search components"
				class="w-full rounded-lg border border-chrome-600 bg-chrome-900 py-2 pl-8 pr-2 text-sm text-chrome-100 placeholder:text-chrome-400 focus:border-accent focus:outline-none"
			/>
		</div>
		<div class="flex gap-1.5">
			{#each categories as cat (cat)}
				<button
					class="rounded-full px-3 py-1 text-xs font-medium transition-colors"
					class:bg-accent={category === cat}
					class:text-white={category === cat}
					class:border={category !== cat}
					class:border-chrome-600={category !== cat}
					class:text-chrome-300={category !== cat}
					aria-pressed={category === cat}
					onclick={() => (category = cat)}
				>
					{cat}
				</button>
			{/each}
		</div>
	</div>

	<div class="thin-scroll min-h-0 flex-1 overflow-y-auto pb-2">
		<div class="grid gap-2" class:grid-cols-3={compact} class:grid-cols-2={!compact}>
			{#each filtered as item (item.type)}
				<button
					draggable={!compact}
					ondragstart={(e) => handleDragStart(e, item.type)}
					onclick={() => place(item.type)}
					class="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-chrome-600 bg-chrome-900 p-3 transition-colors hover:border-accent hover:bg-chrome-700 active:cursor-grabbing"
					class:min-h-touch={compact}
					title={compact ? `Add ${item.label}` : `Drag onto the canvas, or click to add ${item.label}`}
				>
					<svg viewBox="-32 -20 64 40" class="h-9 w-14" aria-hidden="true">
						<ComponentGlyph type={item.type} color={item.defaultColor ?? '#c3cbd6'} scale={0.85} />
					</svg>
					<span class="text-[11px] font-medium leading-tight text-chrome-200">{item.label}</span>
				</button>
			{/each}
		</div>

		{#if filtered.length === 0}
			<div class="flex flex-col items-center gap-2 py-10 text-center">
				<SearchX size={22} class="text-chrome-500" />
				<p class="text-xs text-chrome-300">No components match “{query}”</p>
				<button class="text-xs font-medium text-accent-onDark" onclick={() => (query = '')}>
					Clear search
				</button>
			</div>
		{/if}
	</div>
</div>
