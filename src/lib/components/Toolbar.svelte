<script lang="ts">
	import {
		Trash2,
		Undo2,
		Redo2,
		RotateCw,
		FlipHorizontal2,
		Play,
		Square,
		Pencil,
		Eye,
		SlidersHorizontal,
		Check
	} from 'lucide-svelte';
	import {
		editMode,
		selectedIds,
		selectedWireIds,
		selectedNodeIds,
		wireColor,
		wireStyle,
		deleteSelected,
		undo,
		redo,
		canUndo,
		canRedo,
		rotateComponent,
		mirrorComponent,
		setWireColorFor,
		setWireStyleFor
	} from '$lib/stores/circuit';
	import { isNarrow } from '$lib/stores/ui';
	import { simulationRunning, startSimulation, stopSimulation } from '$lib/stores/simulation';
	import ToolOptions from './ToolOptions.svelte';

	const wireColors = [
		{ value: '#16a34a', label: 'Green' },
		{ value: '#101418', label: 'Black' },
		{ value: '#ef4444', label: 'Red' },
		{ value: '#f59e0b', label: 'Amber' }
	];

	let optionsOpen = $state(false);

	const hasComponentSelection = $derived($selectedIds.size > 0);
	const hasWireSelection = $derived($selectedWireIds.size > 0);
	const selectedComponentId = $derived(
		hasComponentSelection ? (Array.from($selectedIds)[0] ?? null) : null
	);

	function applyWireColor(color: string) {
		wireColor.set(color);
		$selectedWireIds.forEach((id) => setWireColorFor(id, color));
	}

	function applyWireStyle(style: 'solid' | 'dashed') {
		wireStyle.set(style);
		$selectedWireIds.forEach((id) => setWireStyleFor(id, style));
	}
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape') optionsOpen = false;
	}}
/>

<div
	class="relative flex h-12 flex-shrink-0 items-center gap-1 border-b border-chrome-600 bg-chrome-800 px-3"
>
	<!-- Edit / View is the mode switch everything else depends on, so it leads. -->
	<div class="flex items-center gap-0.5 rounded-lg bg-chrome-950 p-0.5">
		<button
			class="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors"
			class:bg-accent={$editMode}
			class:text-white={$editMode}
			class:text-chrome-300={!$editMode}
			aria-pressed={$editMode}
			onclick={() => editMode.set(true)}
		>
			<Pencil size={14} />
			Edit
		</button>
		<button
			class="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors"
			class:bg-accent={!$editMode}
			class:text-white={!$editMode}
			class:text-chrome-300={$editMode}
			aria-pressed={!$editMode}
			onclick={() => editMode.set(false)}
		>
			<Eye size={14} />
			View
		</button>
	</div>

	<span class="mx-1.5 h-6 w-px bg-chrome-600"></span>

	<button
		class="chrome-icon-btn"
		aria-label="Delete"
		disabled={!$editMode || (!hasComponentSelection && !hasWireSelection && $selectedNodeIds.size === 0)}
		onclick={deleteSelected}
	>
		<Trash2 size={16} />
	</button>

	<span class="mx-1.5 h-6 w-px bg-chrome-600"></span>

	<button class="chrome-icon-btn" aria-label="Undo" disabled={!$canUndo} onclick={undo}>
		<Undo2 size={16} />
	</button>
	<button class="chrome-icon-btn" aria-label="Redo" disabled={!$canRedo} onclick={redo}>
		<Redo2 size={16} />
	</button>

	<span class="mx-1.5 h-6 w-px bg-chrome-600"></span>


	{#if $isNarrow}
		<!--
			Below ~1100px the colour swatches and style select no longer fit
			alongside the transform controls, so they move into a popover.
		-->
		<button
			class="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-chrome-200 transition-colors hover:bg-chrome-700"
			aria-expanded={optionsOpen}
			aria-haspopup="dialog"
			onclick={() => (optionsOpen = !optionsOpen)}
		>
			<SlidersHorizontal size={15} />
			<span
				class="h-3.5 w-3.5 rounded-full border border-chrome-500"
				style={`background-color:${$wireColor}`}
			></span>
		</button>

		{#if optionsOpen}
			<div class="fixed inset-0 z-sheet" role="presentation" onclick={() => (optionsOpen = false)}></div>
			<div
				class="absolute left-1/2 top-[52px] z-sheet w-64 -translate-x-1/2 rounded-xl border border-chrome-600 bg-chrome-800 p-4 shadow-raised"
				role="dialog"
				aria-label="Wire options"
			>
				<ToolOptions size="compact" />
			</div>
		{/if}
	{:else}
		<div class="flex items-center gap-1.5 pl-1" role="group" aria-label="Wire colour">
			{#each wireColors as color (color.value)}
				<button
					class="flex h-6 w-6 items-center justify-center rounded-full border-2 transition-transform hover:scale-110"
					class:border-chrome-100={$wireColor === color.value}
					class:border-transparent={$wireColor !== color.value}
					style={`background-color:${color.value}`}
					aria-label={`${color.label} wire`}
					aria-pressed={$wireColor === color.value}
					onclick={() => applyWireColor(color.value)}
				>
					{#if $wireColor === color.value}
						<Check size={13} class="text-white drop-shadow" />
					{/if}
				</button>
			{/each}
		</div>

		<select
			class="ml-1 rounded-lg border border-chrome-600 bg-chrome-900 px-2 py-1.5 text-xs text-chrome-200"
			value={$wireStyle}
			aria-label="Wire style"
			onchange={(e) => applyWireStyle(e.currentTarget.value as 'solid' | 'dashed')}
		>
			<option value="solid">— Solid</option>
			<option value="dashed">┄ Dashed</option>
		</select>
	{/if}

	<span class="mx-1.5 h-6 w-px bg-chrome-600"></span>

	<button
		class="chrome-icon-btn"
		aria-label="Rotate"
		disabled={!selectedComponentId || !$editMode}
		onclick={() => selectedComponentId && rotateComponent(selectedComponentId)}
	>
		<RotateCw size={16} />
	</button>
	<button
		class="chrome-icon-btn"
		aria-label="Mirror"
		disabled={!selectedComponentId || !$editMode}
		onclick={() => selectedComponentId && mirrorComponent(selectedComponentId)}
	>
		<FlipHorizontal2 size={16} />
	</button>

	<div class="flex-1"></div>

	{#if $simulationRunning}
		<button
			class="flex items-center gap-1.5 rounded-lg bg-chrome-700 px-4 py-1.5 text-sm font-semibold text-chrome-100 transition-colors hover:bg-chrome-600"
			onclick={stopSimulation}
		>
			<Square size={12} fill="currentColor" />
			Stop
		</button>
	{:else}
		<button
			class="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
			onclick={startSimulation}
		>
			<Play size={12} fill="currentColor" />
			Run simulation
		</button>
	{/if}
</div>
