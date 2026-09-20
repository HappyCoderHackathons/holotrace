<script lang="ts">
	import { onMount } from 'svelte';
	import { Minus, Plus, Crosshair, MousePointerClick, Maximize } from 'lucide-svelte';
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
	import { isCoarsePointer, isCompact } from '$lib/stores/ui';
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
	/** Pointer travel, in px, before a press becomes a drag rather than a tap. */
	const DRAG_THRESHOLD = 6;

	let svgEl = $state<SVGSVGElement | undefined>();

	/** Every pointer currently down on the canvas, keyed by pointerId. */
	const pointers = new Map<number, { x: number; y: number }>();

	type Gesture = 'none' | 'pan' | 'component' | 'waypoint' | 'pinch';
	let gesture: Gesture = 'none';
	let movedPastThreshold = false;

	let pressOrigin = { x: 0, y: 0 };
	let panOrigin = { x: 0, y: 0 };

	let draggingId: string | null = null;
	let dragOffset = { x: 0, y: 0 };
	let draggingWaypoint: { wireId: string; index: number } | null = null;

	let pinchStart: {
		distance: number;
		zoom: number;
		centroid: { x: number; y: number };
		pan: { x: number; y: number };
	} | null = null;

	/** Pin waiting for its partner. Drives both drag-to-wire and tap-tap wiring. */
	let wireStart = $state<{ componentId: string; pinId: string } | null>(null);
	let wireCursor = $state<{ x: number; y: number } | null>(null);

	function localPoint(clientX: number, clientY: number) {
		const rect = svgEl?.getBoundingClientRect();
		if (!rect) return { x: 0, y: 0 };
		return { x: clientX - rect.left, y: clientY - rect.top };
	}

	function screenToWorld(clientX: number, clientY: number) {
		const p = localPoint(clientX, clientY);
		return { x: (p.x - $canvasPan.x) / $canvasZoom, y: (p.y - $canvasPan.y) / $canvasZoom };
	}

	/**
	 * Zoom about a fixed point on screen, so the circuit under the cursor or
	 * between the fingers stays put. Zooming about the SVG origin instead made
	 * the canvas effectively unusable at phone sizes.
	 */
	function zoomAround(local: { x: number; y: number }, nextZoom: number) {
		const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom));
		const world = {
			x: (local.x - $canvasPan.x) / $canvasZoom,
			y: (local.y - $canvasPan.y) / $canvasZoom
		};
		canvasZoom.set(clamped);
		canvasPan.set({ x: local.x - world.x * clamped, y: local.y - world.y * clamped });
	}

	function centroidOf(points: { x: number; y: number }[]) {
		const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
		return { x: sum.x / points.length, y: sum.y / points.length };
	}

	function beginPinch() {
		const [a, b] = Array.from(pointers.values());
		const distance = Math.hypot(a.x - b.x, a.y - b.y);
		if (distance < 1) return;
		gesture = 'pinch';
		draggingId = null;
		draggingWaypoint = null;
		pinchStart = {
			distance,
			zoom: $canvasZoom,
			centroid: centroidOf([a, b]),
			pan: { ...$canvasPan }
		};
	}

	/** Records every pointer, including presses that land on a component or pin. */
	function trackPointerDown(e: PointerEvent) {
		pointers.set(e.pointerId, localPoint(e.clientX, e.clientY));
		if (pointers.size === 2) beginPinch();
	}

	function handleBackgroundPointerDown(e: PointerEvent) {
		if (e.button !== 0 || gesture === 'pinch') return;
		svgEl?.setPointerCapture(e.pointerId);
		gesture = 'pan';
		movedPastThreshold = false;
		pressOrigin = { x: e.clientX, y: e.clientY };
		panOrigin = { ...$canvasPan };
	}

	function handlePointerMove(e: PointerEvent) {
		if (!pointers.has(e.pointerId)) return;
		pointers.set(e.pointerId, localPoint(e.clientX, e.clientY));

		if (gesture === 'pinch') {
			if (pointers.size < 2 || !pinchStart) return;
			const [a, b] = Array.from(pointers.values());
			const distance = Math.hypot(a.x - b.x, a.y - b.y);
			const centroid = centroidOf([a, b]);
			const world = {
				x: (pinchStart.centroid.x - pinchStart.pan.x) / pinchStart.zoom,
				y: (pinchStart.centroid.y - pinchStart.pan.y) / pinchStart.zoom
			};
			const zoom = Math.min(
				MAX_ZOOM,
				Math.max(MIN_ZOOM, pinchStart.zoom * (distance / pinchStart.distance))
			);
			canvasZoom.set(zoom);
			// Two-finger pan falls out of tracking the centroid as it moves.
			canvasPan.set({ x: centroid.x - world.x * zoom, y: centroid.y - world.y * zoom });
			return;
		}

		if (gesture === 'none') {
			if (editable && wireStart && !$isCoarsePointer) {
				wireCursor = screenToWorld(e.clientX, e.clientY);
			}
			return;
		}

		// A press only becomes a drag once it has travelled far enough, so a tap
		// that wobbles by a pixel or two still reads as a tap.
		if (!movedPastThreshold) {
			const travelled = Math.hypot(e.clientX - pressOrigin.x, e.clientY - pressOrigin.y);
			if (travelled < DRAG_THRESHOLD) return;
			movedPastThreshold = true;
		}

		if (gesture === 'pan') {
			canvasPan.set({
				x: panOrigin.x + (e.clientX - pressOrigin.x),
				y: panOrigin.y + (e.clientY - pressOrigin.y)
			});
		} else if (gesture === 'component' && draggingId && editable) {
			const world = screenToWorld(e.clientX, e.clientY);
			moveComponent(draggingId, world.x - dragOffset.x, world.y - dragOffset.y);
		} else if (gesture === 'waypoint' && draggingWaypoint && editable) {
			const world = screenToWorld(e.clientX, e.clientY);
			updateWireWaypoint(draggingWaypoint.wireId, draggingWaypoint.index, world.x, world.y);
		}
	}

	function handlePointerUp(e: PointerEvent) {
		pointers.delete(e.pointerId);

		if (gesture === 'pinch') {
			// Keep the surviving finger from snapping the canvas to a new pan origin.
			if (pointers.size === 0) gesture = 'none';
			pinchStart = null;
			if (pointers.size === 1) {
				const [remaining] = Array.from(pointers.entries());
				gesture = 'pan';
				movedPastThreshold = true;
				pressOrigin = { x: e.clientX, y: e.clientY };
				panOrigin = { ...$canvasPan };
				void remaining;
			}
			return;
		}

		// A press on empty canvas that never became a pan is a tap: it clears
		// the selection and abandons any pin waiting for a partner.
		if (gesture === 'pan' && !movedPastThreshold) {
			clearSelection();
			cancelWire();
		}

		gesture = 'none';
		movedPastThreshold = false;
		draggingId = null;
		draggingWaypoint = null;

		// With a mouse, releasing anywhere but on a pin abandons the wire. With a
		// finger the pending pin has to survive the release, because the second
		// tap is what completes the connection.
		if (!$isCoarsePointer) cancelWire();
	}

	function cancelWire() {
		wireStart = null;
		wireCursor = null;
	}

	function handleWheel(e: WheelEvent) {
		e.preventDefault();
		const local = localPoint(e.clientX, e.clientY);
		// Trackpad pinch arrives as a ctrl-modified wheel event; both zoom.
		const factor = Math.exp(-e.deltaY * 0.0015);
		zoomAround(local, $canvasZoom * factor);
	}

	function handleComponentPointerDown(e: PointerEvent, id: string) {
		e.stopPropagation();
		if (gesture === 'pinch') return;
		selectedIds.set(new Set([id]));
		selectedWireIds.set(new Set());
		if (!editable) return;

		const comp = $circuit.components.find((c) => c.id === id);
		if (!comp) return;
		(e.currentTarget as Element).setPointerCapture?.(e.pointerId);
		const world = screenToWorld(e.clientX, e.clientY);
		dragOffset = { x: world.x - comp.x, y: world.y - comp.y };
		draggingId = id;
		gesture = 'component';
		movedPastThreshold = false;
		pressOrigin = { x: e.clientX, y: e.clientY };
	}

	function connect(componentId: string, pinId: string) {
		if (!wireStart) return;
		const isSamePin = wireStart.componentId === componentId && wireStart.pinId === pinId;
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
		cancelWire();
	}

	function handlePinPointerDown(e: PointerEvent, componentId: string, pinId: string) {
		e.stopPropagation();
		if (!editable || gesture === 'pinch') return;

		if ($isCoarsePointer && wireStart) {
			// Second tap of a tap-tap connection.
			connect(componentId, pinId);
			return;
		}

		wireStart = { componentId, pinId };
		wireCursor = $isCoarsePointer ? null : screenToWorld(e.clientX, e.clientY);
		selectedIds.set(new Set([componentId]));
		selectedWireIds.set(new Set());
	}

	function handlePinPointerUp(e: PointerEvent, componentId: string, pinId: string) {
		e.stopPropagation();
		// Coarse pointers complete on the next tap instead, handled above.
		if (!wireStart || !editable || $isCoarsePointer) return;
		connect(componentId, pinId);
	}

	function handleWaypointPointerDown(e: PointerEvent, wireId: string, index: number) {
		e.stopPropagation();
		if (!editable) return;
		draggingWaypoint = { wireId, index };
		gesture = 'waypoint';
		movedPastThreshold = false;
		pressOrigin = { x: e.clientX, y: e.clientY };
	}

	function handleWireAddWaypoint(e: MouseEvent, wireId: string) {
		e.stopPropagation();
		if (!editable) return;
		const world = screenToWorld(e.clientX, e.clientY);
		addWireWaypoint(wireId, world.x, world.y);
	}

	function handleComponentClick(id: string) {
		if (movedPastThreshold) return;
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

	/**
	 * Frame the whole circuit. This is what "reset" has to mean here: the
	 * identity transform leaves a detected circuit entirely off-screen at phone
	 * widths, because component coordinates come from the source image, not
	 * from the viewport.
	 */
	function fitToContent() {
		const rect = svgEl?.getBoundingClientRect();
		if (!rect || rect.width === 0) return;

		const points = [
			...$circuit.components.map((c) => ({ x: c.x, y: c.y })),
			...$circuit.wires.flatMap((w) => w.waypoints ?? [])
		];
		if (points.length === 0) {
			canvasZoom.set(1);
			canvasPan.set({ x: 0, y: 0 });
			return;
		}

		// Half the footprint of a glyph plus its labels, in canvas units.
		const EXTENT = 56;
		const minX = Math.min(...points.map((p) => p.x)) - EXTENT;
		const maxX = Math.max(...points.map((p) => p.x)) + EXTENT;
		const minY = Math.min(...points.map((p) => p.y)) - EXTENT;
		const maxY = Math.max(...points.map((p) => p.y)) + EXTENT;

		const PAD = 24;
		const zoom = Math.min(
			MAX_ZOOM,
			Math.max(
				MIN_ZOOM,
				Math.min((rect.width - PAD * 2) / (maxX - minX), (rect.height - PAD * 2) / (maxY - minY))
			)
		);
		canvasZoom.set(zoom);
		canvasPan.set({
			x: rect.width / 2 - ((minX + maxX) / 2) * zoom,
			y: rect.height / 2 - ((minY + maxY) / 2) * zoom
		});
	}

	onMount(() => {
		// Wait for layout so the viewport has real dimensions to fit against.
		const frame = requestAnimationFrame(fitToContent);
		return () => cancelAnimationFrame(frame);
	});

	function zoomByStep(delta: number) {
		const rect = svgEl?.getBoundingClientRect();
		const centre = rect ? { x: rect.width / 2, y: rect.height / 2 } : { x: 0, y: 0 };
		zoomAround(centre, $canvasZoom + delta);
	}

	const transform = $derived(`translate(${$canvasPan.x} ${$canvasPan.y}) scale(${$canvasZoom})`);
	const pendingWireStartPos = $derived(
		wireStart ? pinWorldPos($circuit.components, wireStart.componentId, wireStart.pinId) : null
	);
	const isEmpty = $derived($circuit.components.length === 0);
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape') cancelWire();
	}}
/>

<div
	class="relative h-full w-full overflow-hidden bg-canvas"
	ondrop={editable ? handleDrop : undefined}
	ondragover={editable ? (e) => e.preventDefault() : undefined}
	role="presentation"
>
	<svg
		bind:this={svgEl}
		class="h-full w-full touch-none select-none"
		role="application"
		aria-label="Circuit canvas"
		onpointerdowncapture={trackPointerDown}
		onpointerdown={handleBackgroundPointerDown}
		onpointermove={handlePointerMove}
		onpointerup={handlePointerUp}
		onpointercancel={handlePointerUp}
		onpointerleave={handlePointerUp}
		onwheel={handleWheel}
	>
		<defs>
			<pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
				<circle cx="1" cy="1" r="1" fill="#d7dde5" />
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
				coarse={$isCoarsePointer}
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
					coarse={$isCoarsePointer}
					armedPinId={wireStart?.componentId === component.id ? wireStart.pinId : null}
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
					stroke="#2f6bff"
					stroke-width="2"
					stroke-dasharray="5 4"
					pointer-events="none"
				/>
				<circle cx={wireCursor.x} cy={wireCursor.y} r="4" fill="#2f6bff" pointer-events="none" />
			{/if}
		</g>
	</svg>

	{#if isEmpty}
		<div class="pointer-events-none absolute inset-0 flex items-center justify-center p-8">
			<div class="max-w-xs text-center">
				<Crosshair size={30} class="mx-auto text-ink-400" />
				<p class="mt-3 text-sm font-medium text-ink-700">Nothing on the canvas yet</p>
				<p class="mt-1 text-xs leading-relaxed text-ink-500">
					Upload a photo of a hand-drawn sketch, or add components from the palette.
				</p>
			</div>
		</div>
	{/if}

	{#if wireStart && $isCoarsePointer}
		<div
			class="pointer-events-none absolute inset-x-0 top-3 flex justify-center px-4"
			role="status"
			aria-live="polite"
		>
			<span
				class="flex items-center gap-2 rounded-full bg-accent px-3.5 py-2 text-xs font-medium text-white shadow-accent"
			>
				<MousePointerClick size={14} />
				Tap another pin to connect
			</span>
		</div>
	{/if}

	<!--
		Sits opposite the FAB on compact layouts so the two never collide.
	-->
	<div
		class="absolute flex items-center gap-0.5 rounded-lg border border-canvas-line bg-canvas-raised/95 px-1 py-0.5 shadow-panel backdrop-blur"
		class:right-3={true}
		class:top-3={$isCompact}
		class:bottom-4={!$isCompact}
		class:right-4={!$isCompact}
	>
		<button
			class="flex h-8 w-8 items-center justify-center rounded text-ink-500 transition-colors hover:bg-canvas hover:text-ink-900"
			onclick={() => zoomByStep(-0.15)}
			aria-label="Zoom out"
		>
			<Minus size={15} />
		</button>
		<span class="w-11 text-center font-mono text-[11px] font-medium text-ink-500">
			{Math.round($canvasZoom * 100)}%
		</span>
		<button
			class="flex h-8 w-8 items-center justify-center rounded text-ink-500 transition-colors hover:bg-canvas hover:text-ink-900"
			onclick={() => zoomByStep(0.15)}
			aria-label="Zoom in"
		>
			<Plus size={15} />
		</button>
		<button
			class="ml-0.5 flex h-8 items-center gap-1 rounded px-2 text-[11px] font-medium text-ink-500 transition-colors hover:bg-canvas hover:text-ink-900"
			onclick={fitToContent}
			aria-label="Fit circuit to view"
		>
			<Maximize size={13} />
			Fit
		</button>
	</div>
</div>
