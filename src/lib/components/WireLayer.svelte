<script lang="ts">
	import type { CircuitComponent, Wire } from '$lib/types';
	import { pinWorldPos } from '$lib/geometry';

	interface Props {
		wires: Wire[];
		/** Touch input: wire and waypoint hit areas widen for fingers. */
		coarse?: boolean;
		components: CircuitComponent[];
		selectedWireIds?: Set<string>;
		/** wireId -> normalised current magnitude, 0 to 1 */
		activeCurrent?: Record<string, number>;
		editable?: boolean;
		schematic?: boolean;
		onSelectWire?: (id: string) => void;
		onWaypointPointerDown?: (event: PointerEvent, wireId: string, index: number) => void;
		onWaypointRemove?: (wireId: string, index: number) => void;
		onWireAddWaypoint?: (event: MouseEvent, wireId: string) => void;
	}

	let {
		wires,
		components,
		coarse = false,
		selectedWireIds = new Set(),
		activeCurrent = {},
		editable = false,
		schematic = false,
		onSelectWire = () => {},
		onWaypointPointerDown = () => {},
		onWaypointRemove = () => {},
		onWireAddWaypoint = () => {}
	}: Props = $props();

	function pathFor(wire: Wire): string {
		const from = pinWorldPos(components, wire.fromComponentId, wire.fromPinId);
		const to = pinWorldPos(components, wire.toComponentId, wire.toPinId);
		if (!from || !to) return '';
		const points = [from, ...(wire.waypoints ?? []), to];
		return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
	}

	function wireLabel(wire: Wire): string {
		const from = components.find((c) => c.id === wire.fromComponentId);
		const to = components.find((c) => c.id === wire.toComponentId);
		return `Wire from ${from?.refId ?? '?'} pin ${wire.fromPinId} to ${to?.refId ?? '?'} pin ${wire.toPinId}`;
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
				stroke-linejoin="round"
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
					stroke-linejoin="round"
					class="wire-flow pointer-events-none"
					opacity={0.4 + current * 0.6}
				/>
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
						aria-label={`Waypoint ${i + 1} of ${wireLabel(wire)}`}
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
</g>
