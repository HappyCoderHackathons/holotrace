<script lang="ts">
	import {
		circuit,
		selectedIds,
		selectedWireIds,
		canvasZoom,
		canvasPan,
		moveComponent,
		addComponent,
		clearSelection,
		addWire,
		wireColor,
		wireStyle,
		updateWireWaypoint,
		addWireWaypoint,
		removeWireWaypoint
	} from '$lib/stores/circuit';
	import { simulation, toggleSwitch, switchStates } from '$lib/stores/simulation';
	import { pinWorldPos } from '$lib/geometry';
	import CanvasComponent from './CanvasComponent.svelte';
	import WireLayer from './WireLayer.svelte';
	import type { ComponentType } from '$lib/types';
	import { COMPONENT_TYPES } from '$lib/componentLibrary';

	interface Props {
		editable?: boolean;
		showGrid?: boolean;
		schematic?: boolean;
	}

	let { editable = false, showGrid = true, schematic = false }: Props = $props();

	const MIN_ZOOM = 0.4;
	const MAX_ZOOM = 2.5;

	let svgEl = $state<SVGSVGElement | undefined>();
	let isPanning = $state(false);
	let panStart = { x: 0, y: 0 };
	let panOrigin = { x: 0, y: 0 };

	let draggingId: string | null = null;
	let dragOffset = { x: 0, y: 0 };
	let wireStart = $state<{ componentId: string; pinId: string } | null>(null);
	let wireCursor = $state<{ x: number; y: number } | null>(null);
	let draggingWaypoint: { wireId: string; index: number } | null = null;

	function screenToWorld(clientX: number, clientY: number) {
		if (!svgEl) return { x: 0, y: 0 };
		const rect = svgEl.getBoundingClientRect();
		return {
			x: (clientX - rect.left - $canvasPan.x) / $canvasZoom,
			y: (clientY - rect.top - $canvasPan.y) / $canvasZoom
		};
	}

	function handleBackgroundPointerDown(e: PointerEvent) {
		if (e.button !== 0) return;
		isPanning = true;
		panStart = { x: e.clientX, y: e.clientY };
		panOrigin = { ...$canvasPan };
		clearSelection();
	}

	function handlePointerMove(e: PointerEvent) {
		if (isPanning) {
			canvasPan.set({
				x: panOrigin.x + (e.clientX - panStart.x),
				y: panOrigin.y + (e.clientY - panStart.y)
			});
		} else if (!editable) {
			return;
		} else if (draggingId) {
			const world = screenToWorld(e.clientX, e.clientY);
			moveComponent(draggingId, world.x - dragOffset.x, world.y - dragOffset.y);
		} else if (draggingWaypoint) {
			const world = screenToWorld(e.clientX, e.clientY);
			updateWireWaypoint(draggingWaypoint.wireId, draggingWaypoint.index, world.x, world.y);
		} else if (wireStart) {
			wireCursor = screenToWorld(e.clientX, e.clientY);
		}
	}

	function handlePointerUp() {
		isPanning = false;
		draggingId = null;
		draggingWaypoint = null;
		// A pointerup that did not land on a pin abandons the in-progress wire,
		// otherwise the rubber-band line follows the cursor indefinitely.
		wireStart = null;
		wireCursor = null;
	}

	function handleWheel(e: WheelEvent) {
		e.preventDefault();
		const delta = -e.deltaY * 0.0015;
		canvasZoom.update((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z + delta)));
	}

	function handleComponentPointerDown(e: PointerEvent, id: string) {
		e.stopPropagation();
		selectedIds.set(new Set([id]));
		selectedWireIds.set(new Set());
		if (!editable) return;

		const comp = $circuit.components.find((c) => c.id === id);
		if (!comp) return;
		const world = screenToWorld(e.clientX, e.clientY);
		dragOffset = { x: world.x - comp.x, y: world.y - comp.y };
		draggingId = id;
	}

	function handlePinPointerDown(e: PointerEvent, componentId: string, pinId: string) {
		e.stopPropagation();
		if (!editable) return;
		wireStart = { componentId, pinId };
		wireCursor = screenToWorld(e.clientX, e.clientY);
		selectedIds.set(new Set([componentId]));
	}

	function handlePinPointerUp(e: PointerEvent, componentId: string, pinId: string) {
		e.stopPropagation();
		if (!wireStart || !editable) return;

		const isSamePin =
			wireStart.componentId === componentId && wireStart.pinId === pinId;
		const alreadyWired = $circuit.wires.some(
			(w) =>
				(w.fromComponentId === wireStart!.componentId &&
					w.fromPinId === wireStart!.pinId &&
					w.toComponentId === componentId &&
					w.toPinId === pinId) ||
				(w.toComponentId === wireStart!.componentId &&
					w.toPinId === wireStart!.pinId &&
					w.fromComponentId === componentId &&
					w.fromPinId === pinId)
		);

		if (!isSamePin && !alreadyWired) {
			addWire({
				fromComponentId: wireStart.componentId,
				fromPinId: wireStart.pinId,
				toComponentId: componentId,
				toPinId: pinId,
				color: $wireColor,
				style: $wireStyle
			});
		}
		wireStart = null;
		wireCursor = null;
	}

	function handleWaypointPointerDown(e: PointerEvent, wireId: string, index: number) {
		e.stopPropagation();
		if (!editable) return;
		draggingWaypoint = { wireId, index };
	}

	function handleWireAddWaypoint(e: MouseEvent, wireId: string) {
		e.stopPropagation();
		if (!editable) return;
		const world = screenToWorld(e.clientX, e.clientY);
		addWireWaypoint(wireId, world.x, world.y);
	}

	function handleComponentClick(id: string) {
		const comp = $circuit.components.find((c) => c.id === id);
		if (!comp) return;
		if ((comp.type === 'switch' || comp.type === 'pushbutton') && $simulation.running) {
			toggleSwitch(id);
		}
	}

	function handleSelectWire(id: string) {
		selectedWireIds.set(new Set([id]));
		selectedIds.set(new Set());
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		const type = e.dataTransfer?.getData('component-type');
		if (!type || !COMPONENT_TYPES.includes(type as ComponentType)) return;
		const world = screenToWorld(e.clientX, e.clientY);
		addComponent(type as ComponentType, world.x, world.y);
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
	}

	const transform = $derived(
		`translate(${$canvasPan.x} ${$canvasPan.y}) scale(${$canvasZoom})`
	);
	const pendingWireStartPos = $derived(
		wireStart ? pinWorldPos($circuit.components, wireStart.componentId, wireStart.pinId) : null
	);
</script>

<div
	class="relative h-full w-full overflow-hidden bg-surface-50"
	ondrop={editable ? handleDrop : undefined}
	ondragover={editable ? handleDragOver : undefined}
	role="presentation"
>
	<svg
		bind:this={svgEl}
		class="h-full w-full touch-none select-none"
		role="application"
		aria-label="Circuit canvas"
		onpointerdown={handleBackgroundPointerDown}
		onpointermove={handlePointerMove}
		onpointerup={handlePointerUp}
		onpointerleave={handlePointerUp}
		onwheel={handleWheel}
	>
		<defs>
			<pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
				<circle cx="1" cy="1" r="1" fill="#dfe4e9" />
			</pattern>
		</defs>
		{#if showGrid}
			<rect width="100%" height="100%" fill="url(#grid)" />
		{/if}

		<g {transform}>
			<WireLayer
				wires={$circuit.wires}
				components={$circuit.components}
				selectedWireIds={$selectedWireIds}
				activeCurrent={$simulation.current}
				{editable}
				{schematic}
				onSelectWire={handleSelectWire}
				onWaypointPointerDown={handleWaypointPointerDown}
				onWaypointRemove={removeWireWaypoint}
				onWireAddWaypoint={handleWireAddWaypoint}
			/>
			{#each $circuit.components as component (component.id)}
				<CanvasComponent
					{component}
					selected={$selectedIds.has(component.id)}
					lit={$simulation.ledOn[component.id] ?? false}
					active={$switchStates[component.id] ?? false}
					{editable}
					{schematic}
					onPinPointerDown={(e, pinId) => handlePinPointerDown(e, component.id, pinId)}
					onPinPointerUp={(e, pinId) => handlePinPointerUp(e, component.id, pinId)}
					onpointerdown={(e) => handleComponentPointerDown(e, component.id)}
					onclick={() => handleComponentClick(component.id)}
				/>
			{/each}
			{#if wireStart && wireCursor && pendingWireStartPos}
				<line
					x1={pendingWireStartPos.x}
					y1={pendingWireStartPos.y}
					x2={wireCursor.x}
					y2={wireCursor.y}
					stroke="#2563eb"
					stroke-width="2"
					stroke-dasharray="5 4"
					pointer-events="none"
				/>
				<circle cx={wireCursor.x} cy={wireCursor.y} r="4" fill="#2563eb" pointer-events="none" />
			{/if}
		</g>
	</svg>

	<div class="absolute bottom-4 right-4 flex items-center gap-1 rounded-lg border border-surface-200 bg-white/95 px-2 py-1 shadow-panel">
		<button
			class="rounded px-2 py-1 text-sm text-ink-500 hover:bg-surface-100"
			onclick={() => canvasZoom.update((z) => Math.max(MIN_ZOOM, z - 0.15))}
			aria-label="Zoom out"
		>
			−
		</button>
		<span class="w-12 text-center text-xs font-medium text-ink-500">{Math.round($canvasZoom * 100)}%</span>
		<button
			class="rounded px-2 py-1 text-sm text-ink-500 hover:bg-surface-100"
			onclick={() => canvasZoom.update((z) => Math.min(MAX_ZOOM, z + 0.15))}
			aria-label="Zoom in"
		>
			+
		</button>
		<button
			class="ml-1 rounded px-2 py-1 text-xs font-medium text-ink-500 hover:bg-surface-100"
			onclick={() => {
				canvasZoom.set(1);
				canvasPan.set({ x: 0, y: 0 });
			}}
		>
			Reset
		</button>
	</div>
</div>
