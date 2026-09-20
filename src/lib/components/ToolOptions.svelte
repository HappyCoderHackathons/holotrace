<script lang="ts">
	import { Check } from 'lucide-svelte';
	import FileActions from './FileActions.svelte';
	import Properties from './Properties.svelte';
	import {
		selectedWireIds,
		wireColor,
		wireStyle,
		setWireColorFor,
		setWireStyleFor
	} from '$lib/stores/circuit';

	interface Props {
		/** Larger targets and stacked rows for the mobile sheet. */
		size?: 'compact' | 'touch';
	}

	let { size = 'compact' }: Props = $props();

	/*
	 * Blue is deliberately absent: it is the accent and the selection colour, so
	 * a blue wire would be indistinguishable from a selected one.
	 */
	const wireColors = [
		{ value: '#16a34a', label: 'Green' },
		{ value: '#101418', label: 'Black' },
		{ value: '#ef4444', label: 'Red' },
		{ value: '#f59e0b', label: 'Amber' }
	];

	const touch = $derived(size === 'touch');

	function applyWireColor(color: string) {
		wireColor.set(color);
		$selectedWireIds.forEach((id) => setWireColorFor(id, color));
	}

	function applyWireStyle(style: 'solid' | 'dashed') {
		wireStyle.set(style);
		$selectedWireIds.forEach((id) => setWireStyleFor(id, style));
	}
</script>

<div class="space-y-4" class:space-y-3={!touch}>
	<div class="space-y-1.5">
		<span class="panel-label">
			Wire colour{$selectedWireIds.size > 0 ? ' — applies to selection' : ''}
		</span>
		<div class="flex gap-2">
			{#each wireColors as color (color.value)}
				<button
					class="flex items-center justify-center rounded-full border-2 transition-transform hover:scale-110"
					class:h-touch={touch}
					class:w-touch={touch}
					class:h-7={!touch}
					class:w-7={!touch}
					class:border-chrome-100={$wireColor === color.value}
					class:border-transparent={$wireColor !== color.value}
					style={`background-color:${color.value}`}
					aria-label={`${color.label} wire`}
					aria-pressed={$wireColor === color.value}
					onclick={() => applyWireColor(color.value)}
				>
					{#if $wireColor === color.value}
						<Check size={touch ? 18 : 14} class="text-white drop-shadow" />
					{/if}
				</button>
			{/each}
		</div>
	</div>

	<div class="space-y-1.5">
		<span class="panel-label">Wire style</span>
		<div class="flex gap-1.5">
			{#each ['solid', 'dashed'] as const as style (style)}
				<button
					class="flex-1 rounded-lg border text-sm font-medium capitalize transition-colors"
					class:py-2.5={touch}
					class:py-1.5={!touch}
					class:bg-chrome-700={$wireStyle === style}
					class:border-chrome-500={$wireStyle === style}
					class:text-chrome-100={$wireStyle === style}
					class:border-chrome-600={$wireStyle !== style}
					class:text-chrome-300={$wireStyle !== style}
					aria-pressed={$wireStyle === style}
					onclick={() => applyWireStyle(style)}
				>
					{style}
				</button>
			{/each}
		</div>
	</div>

	{#if touch}
		<Properties touch />
		<div class="space-y-1.5">
			<span class="panel-label">Circuit file</span>
			<FileActions stacked />
		</div>
	{/if}
</div>
