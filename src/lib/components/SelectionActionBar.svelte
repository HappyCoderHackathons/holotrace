<script lang="ts">
	import { RotateCw, FlipHorizontal2, Copy, Trash2, X } from 'lucide-svelte';
	import {
		circuit,
		selectedIds,
		selectedWireIds,
		editMode,
		deleteSelected,
		rotateComponent,
		mirrorComponent,
		clearSelection
	} from '$lib/stores/circuit';

	const selectedComponentId = $derived(Array.from($selectedIds)[0] ?? null);
	const selected = $derived($circuit.components.find((c) => c.id === selectedComponentId) ?? null);
	const wireCount = $derived($selectedWireIds.size);
	const visible = $derived($selectedIds.size > 0 || wireCount > 0);
	const canTransform = $derived(Boolean(selected) && $editMode);
</script>

{#if visible}
	<!--
		Floats above the canvas rather than displacing it, so selecting something
		never reflows the drawing out from under the finger that selected it.
	-->
	<div
		class="pointer-events-auto absolute inset-x-3 bottom-3 flex items-center gap-1.5 rounded-xl border border-chrome-600 bg-chrome-900/95 p-1.5 shadow-raised backdrop-blur"
		role="toolbar"
		aria-label="Selection actions"
	>
		<span class="px-2 font-mono text-xs font-semibold text-accent-onDark">
			{selected ? selected.refId : `${wireCount} wire${wireCount === 1 ? '' : 's'}`}
		</span>

		<div class="ml-auto flex items-center gap-1">
			<button
				class="chrome-icon-btn"
				aria-label="Rotate"
				disabled={!canTransform}
				onclick={() => selectedComponentId && rotateComponent(selectedComponentId)}
			>
				<RotateCw size={17} />
			</button>
			<button
				class="chrome-icon-btn"
				aria-label="Mirror"
				disabled={!canTransform}
				onclick={() => selectedComponentId && mirrorComponent(selectedComponentId)}
			>
				<FlipHorizontal2 size={17} />
			</button>
			<button class="chrome-icon-btn" aria-label="Duplicate" disabled>
				<Copy size={17} />
			</button>
			<button
				class="chrome-icon-btn text-signal-danger hover:bg-signal-danger/15"
				aria-label="Delete"
				onclick={deleteSelected}
			>
				<Trash2 size={17} />
			</button>
			<span class="mx-0.5 h-6 w-px bg-chrome-600"></span>
			<button class="chrome-icon-btn" aria-label="Clear selection" onclick={clearSelection}>
				<X size={17} />
			</button>
		</div>
	</div>
{/if}
