<script lang="ts">
	import { CircleDot, Route, Trash2 } from 'lucide-svelte';
	import {
		circuit,
		deleteSelected,
		editMode,
		pendingWire,
		resetWireRoute,
		selectedIds,
		selectedNodeIds,
		selectedWireIds,
		splitWire,
		updateComponent
	} from '$lib/stores/circuit';
	import { endPoint } from '$lib/geometry';
	import { midpoint, routeWire } from '$lib/routing';

	interface Props {
		touch?: boolean;
		/** Where the rule separating it from its neighbours goes. */
		divider?: 'top' | 'bottom';
	}

	let { touch = false, divider = 'top' }: Props = $props();

	const component = $derived(
		$selectedIds.size === 1 ? ($circuit.components.find((c) => $selectedIds.has(c.id)) ?? null) : null
	);
	const wire = $derived(
		$selectedWireIds.size === 1 ? ($circuit.wires.find((w) => $selectedWireIds.has(w.id)) ?? null) : null
	);
	const node = $derived(
		$selectedNodeIds.size === 1 ? ($circuit.nodes.find((n) => $selectedNodeIds.has(n.id)) ?? null) : null
	);

	const field =
		'w-full rounded-lg border border-chrome-600 bg-chrome-900 px-2.5 text-sm text-chrome-100 focus:border-accent focus:outline-none disabled:opacity-50';
	const action =
		'flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-chrome-600 text-sm font-medium text-chrome-200 transition-colors hover:bg-chrome-700 disabled:opacity-40';

	function commit(id: string, key: 'refId' | 'label' | 'value' | 'color', event: Event) {
		// On change (blur or Enter), so typing is one undo step, not one per letter.
		const text = (event.currentTarget as HTMLInputElement).value.trim();
		if (key === 'refId' && text === '') return;
		updateComponent(id, { [key]: text === '' && key !== 'label' ? undefined : text });
	}

	function addJunction() {
		if (!wire) return;
		const from = endPoint($circuit.components, $circuit.nodes, wire.from);
		const to = endPoint($circuit.components, $circuit.nodes, wire.to);
		if (!from || !to) return;
		const at = midpoint(routeWire(from, to, wire.waypoints ?? []));
		const nodeId = splitWire(wire.id, at.x, at.y);
		if (nodeId) selectedNodeIds.set(new Set([nodeId]));
		selectedWireIds.set(new Set());
	}
</script>

{#if component || wire || node}
	<div
		class="space-y-2 border-chrome-600"
		class:border-t={divider === 'top'}
		class:pt-3={divider === 'top'}
		class:border-b={divider === 'bottom'}
		class:pb-3={divider === 'bottom'}
		class:mb-3={divider === 'bottom'}
	>
		<span class="panel-label">
			{component ? `Part ${component.refId}` : wire ? 'Wire' : 'Junction'}
		</span>

		{#if component}
			<label class="block space-y-1">
				<span class="text-[11px] text-chrome-400">Reference</span>
				<input
					class={field}
					class:py-2.5={touch}
					class:py-1.5={!touch}
					value={component.refId}
					disabled={!$editMode}
					onchange={(e) => commit(component.id, 'refId', e)}
				/>
			</label>
			{#if component.type === 'generic'}
				<label class="block space-y-1">
					<span class="text-[11px] text-chrome-400">Name</span>
					<input
						class={field}
						class:py-2.5={touch}
						class:py-1.5={!touch}
						value={component.label}
						disabled={!$editMode}
						onchange={(e) => commit(component.id, 'label', e)}
					/>
				</label>
			{/if}
			<label class="block space-y-1">
				<span class="text-[11px] text-chrome-400">Value</span>
				<input
					class={field}
					class:py-2.5={touch}
					class:py-1.5={!touch}
					value={component.value ?? ''}
					placeholder="e.g. 220Ω, 3V"
					disabled={!$editMode}
					onchange={(e) => commit(component.id, 'value', e)}
				/>
			</label>
			{#if component.type === 'led'}
				<label class="flex items-center justify-between gap-3">
					<span class="text-[11px] text-chrome-400">Colour</span>
					<input
						type="color"
						class="h-8 w-14 cursor-pointer rounded border border-chrome-600 bg-chrome-900"
						value={component.color ?? '#e11d2e'}
						disabled={!$editMode}
						onchange={(e) => commit(component.id, 'color', e)}
					/>
				</label>
			{/if}
		{/if}

		{#if wire}
			<div class="flex gap-1.5">
				<button class={action} class:py-2.5={touch} class:py-1.5={!touch} disabled={!$editMode} onclick={addJunction}>
					<CircleDot size={14} />
					Add junction
				</button>
				<button
					class={action}
					class:py-2.5={touch}
					class:py-1.5={!touch}
					disabled={!$editMode || !(wire.waypoints?.length)}
					onclick={() => resetWireRoute(wire.id)}
				>
					<Route size={14} />
					Re-route
				</button>
			</div>
			<p class="text-[11px] leading-relaxed text-chrome-400">
				Double-click a wire to add a corner and drag it. Alt-click a wire to start a new wire from it.
			</p>
		{/if}

		{#if node}
			<div class="flex gap-1.5">
				<button
					class={action}
					class:py-2.5={touch}
					class:py-1.5={!touch}
					disabled={!$editMode}
					onclick={() => pendingWire.set({ nodeId: node.id })}
				>
					<Route size={14} />
					Wire from here
				</button>
			</div>
		{/if}

		<button class={action + ' w-full'} class:py-2.5={touch} class:py-1.5={!touch} disabled={!$editMode} onclick={deleteSelected}>
			<Trash2 size={14} />
			Delete
		</button>
	</div>
{/if}
