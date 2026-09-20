<script lang="ts">
	import { Cable, MousePointer2, Check } from 'lucide-svelte';
	import FileActions from './FileActions.svelte';
	import Properties from './Properties.svelte';
	import {
		editMode,
		editTool,
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
		<span class="panel-label">Tool</span>
		<div class="flex gap-1.5">
			<button
				class="flex flex-1 items-center justify-center gap-1.5 rounded-lg border text-sm font-medium transition-colors"
				class:py-2.5={touch}
				class:py-1.5={!touch}
				class:bg-accent={$editTool === 'select'}
				class:border-accent={$editTool === 'select'}
				class:text-white={$editTool === 'select'}
				class:border-chrome-600={$editTool !== 'select'}
				class:text-chrome-200={$editTool !== 'select'}
				aria-pressed={$editTool === 'select'}
				onclick={() => editTool.set('select')}
			>
				<MousePointer2 size={15} />
				Select
			</button>
			<button
				class="flex flex-1 items-center justify-center gap-1.5 rounded-lg border text-sm font-medium transition-colors disabled:opacity-40"
				class:py-2.5={touch}
				class:py-1.5={!touch}
				class:bg-accent={$editTool === 'wire'}
				class:border-accent={$editTool === 'wire'}
				class:text-white={$editTool === 'wire'}
				class:border-chrome-600={$editTool !== 'wire'}
				class:text-chrome-200={$editTool !== 'wire'}
				disabled={!$editMode}
				aria-pressed={$editTool === 'wire'}
				onclick={() => editTool.set('wire')}
			>
				<Cable size={15} />
				Wire
			</button>
		</div>
		{#if !$editMode}
			<p class="text-[11px] text-chrome-400">Switch to Edit mode to draw wires.</p>
		{/if}
	</div>

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
