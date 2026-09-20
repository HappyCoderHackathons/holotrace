<script lang="ts">
	import type { CircuitComponent, Wire, WireEnd, WireNode } from '$lib/types';
	import { endPoint } from '$lib/geometry';
	import { pathData, routeWire } from '$lib/routing';

	interface Props {
		wires: Wire[];
		nodes?: WireNode[];
		/** Touch input: wire and waypoint hit areas widen for fingers. */
		coarse?: boolean;
		components: CircuitComponent[];
		selectedWireIds?: Set<string>;
		selectedNodeIds?: Set<string>;
		/** wireId -> normalised current magnitude, 0 to 1 */
		activeCurrent?: Record<string, number>;
		editable?: boolean;
		schematic?: boolean;
		onSelectWire?: (id: string) => void;
		onWaypointPointerDown?: (event: PointerEvent, wireId: string, index: number) => void;
		onWaypointRemove?: (wireId: string, index: number) => void;
		onWireAddWaypoint?: (event: MouseEvent, wireId: string) => void;
		onWirePointerDown?: (event: PointerEvent, wireId: string) => void;
		onWirePointerUp?: (event: PointerEvent, wireId: string) => void;
		onNodePointerDown?: (event: PointerEvent, nodeId: string) => void;
		onNodePointerUp?: (event: PointerEvent, nodeId: string) => void;
	}

	let {
		wires,
		nodes = [],
		components,
		coarse = false,
		selectedWireIds = new Set(),
		selectedNodeIds = new Set(),
		activeCurrent = {},
		editable = false,
		schematic = false,
		onSelectWire = () => {},
		onWaypointPointerDown = () => {},
		onWaypointRemove = () => {},
		onWireAddWaypoint = () => {},
		onWirePointerDown = () => {},
		onWirePointerUp = () => {},
		onNodePointerDown = () => {},
		onNodePointerUp = () => {}
	}: Props = $props();

	function pathFor(wire: Wire): string {
		const from = endPoint(components, nodes, wire.from);
		const to = endPoint(components, nodes, wire.to);
		if (!from || !to) return '';
		return pathData(routeWire(from, to, wire.waypoints ?? []));
	}

	/** Grab handles at the middle of each segment long enough to hold one, for moving that segment. */
	function handlesFor(wire: Wire): { x: number; y: number; horizontal: boolean }[] {
		const from = endPoint(components, nodes, wire.from);
		const to = endPoint(components, nodes, wire.to);
		if (!from || !to) return [];
		const route = routeWire(from, to, wire.waypoints ?? []);
		const found: { x: number; y: number; horizontal: boolean }[] = [];
		for (let i = 1; i < route.length; i++) {
			const a = route[i - 1];
			const b = route[i];
			if (Math.hypot(b.x - a.x, b.y - a.y) < 24) continue;
			found.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, horizontal: a.y === b.y });
		}
		return found;
	}

	function endName(end: WireEnd): string {
		if ('nodeId' in end) return 'a junction';
		const comp = components.find((c) => c.id === end.componentId);
		return `${comp?.refId ?? '?'} pin ${end.pinId}`;
	}

	function wireLabel(wire: Wire): string {
		return `Wire from ${endName(wire.from)} to ${endName(wire.to)}`;
	}

	/** Junctions that three or more wires meet at are drawn as a dot, as on a schematic. */
	function wiresAt(nodeId: string): number {
		return wires.filter(
			(w) => ('nodeId' in w.from && w.from.nodeId === nodeId) || ('nodeId' in w.to && w.to.nodeId === nodeId)
		).length;
	}
</script>

<g>
	{#each wires as wire (wire.id)}
		{@const d = pathFor(wire)}
		{@const isSelected = selectedWireIds.has(wire.id)}
		{@const current = activeCurrent[wire.id] ?? 0}
		{#if d}
			<!-- Wide transparent path widens the hit area for pointer and touch input -->
			<path
				{d}
				fill="none"
				stroke="transparent"
				stroke-width={coarse ? 26 : 14}
				class="cursor-pointer focus:outline-none"
				role="button"
				tabindex="0"
				aria-label={wireLabel(wire)}
				aria-pressed={isSelected}
				onclick={() => onSelectWire(wire.id)}
				onpointerdown={(e) => onWirePointerDown(e, wire.id)}
				onpointerup={(e) => onWirePointerUp(e, wire.id)}
				onkeydown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						onSelectWire(wire.id);
					}
				}}
				ondblclick={(e) => editable && onWireAddWaypoint(e, wire.id)}
			/>
			<path
				{d}
				fill="none"
				stroke={isSelected ? '#2f6bff' : schematic ? '#16a34a' : wire.color}
				stroke-width={isSelected ? 3 : 2.5}
				stroke-linecap="round"
				stroke-linejoin="miter"
				stroke-dasharray={wire.style === 'dashed' ? '6 5' : undefined}
				class="pointer-events-none"
			/>
			{#if current > 0.02}
				<path
					{d}
					fill="none"
					stroke="#facc15"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="miter"
					class="wire-flow pointer-events-none"
					opacity={0.4 + current * 0.6}
				/>
			{/if}
			{#if editable && isSelected}
				{#each handlesFor(wire) as handle}
					<rect
						x={handle.x - (coarse ? 8 : 5)}
						y={handle.y - (coarse ? 8 : 5)}
						width={coarse ? 16 : 10}
						height={coarse ? 16 : 10}
						rx="2"
						fill="#2f6bff"
						stroke="#ffffff"
						stroke-width="1.5"
						class={handle.horizontal ? 'cursor-ns-resize' : 'cursor-ew-resize'}
						role="presentation"
						onpointerdown={(e) => onWirePointerDown(e, wire.id)}
					/>
				{/each}
			{/if}
			{#if editable}
				{#each wire.waypoints ?? [] as point, i}
					<circle
						cx={point.x}
						cy={point.y}
						r={coarse ? 9 : isSelected ? 6 : 5}
						fill="#ffffff"
						stroke={isSelected ? '#2f6bff' : '#6b7685'}
						stroke-width="2"
						class="cursor-move"
						role="button"
						tabindex="0"
						aria-label={`Corner ${i + 1} of ${wireLabel(wire)}`}
						onpointerdown={(e) => onWaypointPointerDown(e, wire.id, i)}
						ondblclick={(e) => {
							e.stopPropagation();
							onWaypointRemove(wire.id, i);
						}}
						onkeydown={(e) => {
							if (e.key === 'Delete' || e.key === 'Backspace') {
								e.preventDefault();
								e.stopPropagation();
								onWaypointRemove(wire.id, i);
							}
						}}
					/>
				{/each}
			{/if}
		{/if}
	{/each}

	{#each nodes as node (node.id)}
		{@const isSelected = selectedNodeIds.has(node.id)}
		<circle
			cx={node.x}
			cy={node.y}
			r={coarse ? 10 : wiresAt(node.id) >= 3 ? 5 : 4}
			fill={isSelected ? '#2f6bff' : schematic ? '#16a34a' : '#111827'}
			stroke="#ffffff"
			stroke-width="1.5"
			class={editable ? 'cursor-move' : ''}
			role="button"
			tabindex="0"
			aria-label={`Junction, ${wiresAt(node.id)} wires`}
			onpointerdown={(e) => onNodePointerDown(e, node.id)}
			onpointerup={(e) => onNodePointerUp(e, node.id)}
		/>
	{/each}
</g>
