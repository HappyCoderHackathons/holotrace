<script lang="ts">
	import {
		Copy,
		Trash2,
		Undo2,
		Redo2,
		RotateCw,
		FlipHorizontal2,
		MousePointer2,
		Play,
		Square,
		Pencil,
		Eye,
		Cable
	} from 'lucide-svelte';
	import {
		editMode,
		selectedIds,
		selectedWireIds,
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
		setWireStyleFor,
		circuit,
		editTool
	} from '$lib/stores/circuit';
	import { simulationRunning, startSimulation, stopSimulation } from '$lib/stores/simulation';

	const wireColors = ['#22c55e', '#111827', '#ef4444', '#2563eb', '#f59e0b'];

	const hasComponentSelection = $derived($selectedIds.size > 0);
	const hasWireSelection = $derived($selectedWireIds.size > 0);
	const selectedComponentId = $derived(
		hasComponentSelection ? (Array.from($selectedIds)[0] ?? null) : null
	);

	function applyWireColor(color: string) {
		wireColor.set(color);
		if (hasWireSelection) {
			$selectedWireIds.forEach((id) => setWireColorFor(id, color));
		}
	}

	function applyWireStyle(style: 'solid' | 'dashed') {
		wireStyle.set(style);
		if (hasWireSelection) {
			$selectedWireIds.forEach((id) => setWireStyleFor(id, style));
		}
	}
</script>

<div class="flex h-12 flex-shrink-0 items-center gap-1 border-b border-surface-200 bg-surface-50 px-3 shadow-toolbar">
	<div class="flex items-center gap-1 rounded-md bg-white p-0.5 border border-surface-200">
		<button
			class="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-sm font-medium"
			class:bg-accent={$editMode}
			class:text-white={$editMode}
			class:text-ink-700={!$editMode}
			aria-pressed={$editMode}
			onclick={() => editMode.set(true)}
		>
			<Pencil size={14} />
			Edit
		</button>
		<button
			class="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-sm font-medium"
			class:bg-accent={!$editMode}
			class:text-white={!$editMode}
			class:text-ink-700={$editMode}
			aria-pressed={!$editMode}
			onclick={() => editMode.set(false)}
		>
			<Eye size={14} />
			View
		</button>
	</div>

	<div class="mx-2 h-6 w-px bg-surface-200"></div>

	<button
		class="rounded-md p-2 text-ink-500 hover:bg-surface-100 disabled:opacity-30"
		aria-label="Copy"
		disabled={!hasComponentSelection}
	>
		<Copy size={16} />
	</button>
	<button
		class="rounded-md p-2 text-ink-500 hover:bg-surface-100 disabled:opacity-30"
		aria-label="Delete"
		disabled={!hasComponentSelection && !hasWireSelection}
		onclick={deleteSelected}
	>
		<Trash2 size={16} />
	</button>

	<div class="mx-1 h-6 w-px bg-surface-200"></div>

	<button
		class="rounded-md p-2 text-ink-500 hover:bg-surface-100 disabled:opacity-30"
		aria-label="Undo"
		disabled={!$canUndo}
		onclick={undo}
	>
		<Undo2 size={16} />
	</button>
	<button
		class="rounded-md p-2 text-ink-500 hover:bg-surface-100 disabled:opacity-30"
		aria-label="Redo"
		disabled={!$canRedo}
		onclick={redo}
	>
		<Redo2 size={16} />
	</button>

	<div class="mx-1 h-6 w-px bg-surface-200"></div>

	<button
		class="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium hover:bg-surface-100"
		class:bg-accent={$editTool === 'wire'}
		class:text-white={$editTool === 'wire'}
		class:text-ink-600={$editTool !== 'wire'}
		disabled={!$editMode}
		aria-label="Wire tool"
		aria-pressed={$editTool === 'wire'}
		onclick={() => editTool.set($editTool === 'wire' ? 'select' : 'wire')}
	>
		<Cable size={15} />
		Wire
	</button>

	<div class="flex items-center gap-1">
		{#each wireColors as color (color)}
			<button
				class="h-6 w-6 rounded-full border-2 transition-transform hover:scale-110"
				class:border-ink-900={$wireColor === color}
				class:border-transparent={$wireColor !== color}
				style={`background-color:${color}`}
				aria-label={`Wire color ${color}`}
				aria-pressed={$wireColor === color}
				onclick={() => applyWireColor(color)}
			></button>
		{/each}
	</div>

	<select
		class="ml-1 rounded-md border border-surface-200 bg-white px-2 py-1.5 text-xs text-ink-700"
		value={$wireStyle}
		aria-label="Wire style"
		onchange={(e) => applyWireStyle(e.currentTarget.value as 'solid' | 'dashed')}
	>
		<option value="solid">— Solid</option>
		<option value="dashed">┄ Dashed</option>
	</select>

	<div class="mx-1 h-6 w-px bg-surface-200"></div>

	<button
		class="rounded-md p-2 text-ink-500 hover:bg-surface-100 disabled:opacity-30"
		aria-label="Rotate"
		disabled={!selectedComponentId || !$editMode}
		onclick={() => selectedComponentId && rotateComponent(selectedComponentId)}
	>
		<RotateCw size={16} />
	</button>
	<button
		class="rounded-md p-2 text-ink-500 hover:bg-surface-100 disabled:opacity-30"
		aria-label="Mirror"
		disabled={!selectedComponentId || !$editMode}
		onclick={() => selectedComponentId && mirrorComponent(selectedComponentId)}
	>
		<FlipHorizontal2 size={16} />
	</button>

	<div class="flex-1"></div>

	{#if $simulationRunning}
		<button
			class="flex items-center gap-1.5 rounded-lg bg-ink-900 px-4 py-1.5 text-sm font-semibold text-white hover:bg-ink-700"
			onclick={stopSimulation}
		>
			<Square size={13} fill="white" />
			Stop Simulation
		</button>
	{:else}
		<button
			class="flex items-center gap-1.5 rounded-lg bg-live px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-green-700"
			onclick={startSimulation}
		>
			<Play size={13} fill="white" />
			Start Simulation
		</button>
	{/if}
</div>
