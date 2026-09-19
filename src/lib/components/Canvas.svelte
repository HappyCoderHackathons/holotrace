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
	import { simulation } from '$lib/stores/simulation';
	import { toggleSwitch, switchStates } from '$lib/stores/simulation';
	import CanvasComponent from './CanvasComponent.svelte';
	import WireLayer from './WireLayer.svelte';
	import type { ComponentType } from '$lib/types';

	export let editable: boolean = false;
	export let showGrid: boolean = true;
	export let schematic: boolean = false;

	let svgEl: SVGSVGElement;
	let containerEl: HTMLDivElement;
	let isPanning = false;
	let panStart = { x: 0, y: 0 };
	let panOrigin = { x: 0, y: 0 };

	let draggingId: string | null = null;
	let dragOffset = { x: 0, y: 0 };
	let wireStart: { componentId: string; pinId: string } | null = null;
	let wireCursor: { x: number; y: number } | null = null;
	let draggingWaypoint: { wireId: string; index: number } | null = null;

	function pinWorldPos(compId: string, pinId: string): { x: number; y: number } | null {
		const comp = $circuit.components.find((c) => c.id === compId);
		if (!comp) return null;
		const pin = comp.pins.find((p) => p.id === pinId);
		if (!pin) return null;
		const rad = (comp.rotation * Math.PI) / 180;
		const mirror = comp.mirrored ? -1 : 1;
		const px = pin.x * mirror;
		const py = pin.y;
		const rx = px * Math.cos(rad) - py * Math.sin(rad);
		const ry = px * Math.sin(rad) + py * Math.cos(rad);
		return { x: comp.x + rx, y: comp.y + ry };
	}

	function screenToWorld(clientX: number, clientY: number) {
		const rect = svgEl.getBoundingClientRect();
		const zoom = $canvasZoom;
		const pan = $canvasPan;
		return {
			x: (clientX - rect.left - pan.x) / zoom,
			y: (clientY - rect.top - pan.y) / zoom
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
		} else if (draggingId && editable) {
			const world = screenToWorld(e.clientX, e.clientY);
			moveComponent(draggingId, world.x - dragOffset.x, world.y - dragOffset.y);
		} else if (draggingWaypoint && editable) {
			const world = screenToWorld(e.clientX, e.clientY);
			updateWireWaypoint(draggingWaypoint.wireId, draggingWaypoint.index, world.x, world.y);
		} else if (wireStart && editable) {
			wireCursor = screenToWorld(e.clientX, e.clientY);
		}
	}

	function handlePointerUp() {
		isPanning = false;
		draggingId = null;
		draggingWaypoint = null;
	}

	function handleWheel(e: WheelEvent) {
		e.preventDefault();
		const delta = -e.deltaY * 0.0015;
		canvasZoom.update((z) => Math.min(2.5, Math.max(0.4, z + delta)));
	}

	function handleComponentPointerDown(e: PointerEvent, id: string) {
		e.stopPropagation();
		if (!editable) {
			selectedIds.set(new Set([id]));
			selectedWireIds.set(new Set());
			return;
		}
		selectedIds.set(new Set([id]));
		selectedWireIds.set(new Set());
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
		if (wireStart.componentId !== componentId || wireStart.pinId !== pinId) {
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
		selectedIds.set(new Set());
	}

	function handleWaypointPointerDown(e: PointerEvent, wireId: string, index: number) {
		e.stopPropagation();
		if (!editable) return;
		draggingWaypoint = { wireId, index };
	}

	function handleWaypointDoubleClick(e: MouseEvent, wireId: string, index: number) {
		e.stopPropagation();
		if (!editable) return;
		removeWireWaypoint(wireId, index);
	}

	function handleWireDoubleClick(e: MouseEvent, wireId: string) {
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
		const type = e.dataTransfer?.getData('component-type') as ComponentType | undefined;
		if (!type || !svgEl) return;
		const world = screenToWorld(e.clientX, e.clientY);
		addComponent(type, world.x, world.y);
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
	}

	$: transform = `translate(${$canvasPan.x} ${$canvasPan.y}) scale(${$canvasZoom})`;
	$: pendingWireStartPos = wireStart ? pinWorldPos(wireStart.componentId, wireStart.pinId) : null;
</script>

<div
	bind:this={containerEl}
	class="relative h-full w-full overflow-hidden bg-surface-50"
	on:drop={editable ? handleDrop : undefined}
	on:dragover={editable ? handleDragOver : undefined}
>
	<svg
		bind:this={svgEl}
		class="h-full w-full touch-none select-none"
		role="application"
		aria-label="Circuit canvas"
		on:pointerdown={handleBackgroundPointerDown}
		on:pointermove={handlePointerMove}
		on:pointerup={handlePointerUp}
		on:pointerleave={handlePointerUp}
		on:wheel={handleWheel}
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
				onWaypointDoubleClick={handleWaypointDoubleClick}
				onWireDoubleClick={handleWireDoubleClick}
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
					on:pointerdown={(e) => handleComponentPointerDown(e, component.id)}
					on:click={() => handleComponentClick(component.id)}
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
			on:click={() => canvasZoom.update((z) => Math.max(0.4, z - 0.15))}
			aria-label="Zoom out"
		>
			−
		</button>
		<span class="w-12 text-center text-xs font-medium text-ink-500">{Math.round($canvasZoom * 100)}%</span>
		<button
			class="rounded px-2 py-1 text-sm text-ink-500 hover:bg-surface-100"
			on:click={() => canvasZoom.update((z) => Math.min(2.5, z + 0.15))}
			aria-label="Zoom in"
		>
			+
		</button>
		<button
			class="ml-1 rounded px-2 py-1 text-xs font-medium text-ink-500 hover:bg-surface-100"
			on:click={() => {
				canvasZoom.set(1);
				canvasPan.set({ x: 0, y: 0 });
			}}
		>
			Reset
		</button>
	</div>
</div>
