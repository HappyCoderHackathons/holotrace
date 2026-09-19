<script lang="ts">
	import type { CircuitComponent, Wire } from '$lib/types';

	export let wires: Wire[];
	export let components: CircuitComponent[];
	export let selectedWireIds: Set<string> = new Set();
	export let activeCurrent: Record<string, number> = {};
	export let editable: boolean = false;
	export let schematic: boolean = false;
	export let onSelectWire: (id: string) => void = () => {};
	export let onWaypointPointerDown: (event: PointerEvent, wireId: string, index: number) => void =
		() => {};
	export let onWaypointDoubleClick: (event: MouseEvent, wireId: string, index: number) => void =
		() => {};
	export let onWireDoubleClick: (event: MouseEvent, wireId: string) => void = () => {};

	function pinWorldPos(compId: string, pinId: string): { x: number; y: number } | null {
		const comp = components.find((c) => c.id === compId);
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

	function pathFor(wire: Wire): string {
		const from = pinWorldPos(wire.fromComponentId, wire.fromPinId);
		const to = pinWorldPos(wire.toComponentId, wire.toPinId);
		if (!from || !to) return '';
		const points = [from, ...(wire.waypoints ?? []), to];
		return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
	}
</script>

<g>
	{#each wires as wire (wire.id)}
		{@const d = pathFor(wire)}
		{@const isSelected = selectedWireIds.has(wire.id)}
		{@const current = activeCurrent[wire.id] ?? 0}
		{#if d}
			<path
				{d}
				fill="none"
				stroke="transparent"
				stroke-width="14"
				class={editable ? 'cursor-pointer' : 'cursor-pointer'}
				role="presentation"
				on:click={() => onSelectWire(wire.id)}
				on:dblclick={(e) => editable && onWireDoubleClick(e, wire.id)}
			/>
			<path
				{d}
				fill="none"
				stroke={isSelected ? '#2563eb' : schematic ? '#16a34a' : wire.color}
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
						r={isSelected ? 6 : 5}
						fill="#ffffff"
						stroke={isSelected ? '#2563eb' : '#64748b'}
						stroke-width="2"
						class="cursor-move"
						role="presentation"
						on:pointerdown={(e) => onWaypointPointerDown(e, wire.id, i)}
						on:dblclick={(e) => onWaypointDoubleClick(e, wire.id, i)}
					/>
				{/each}
			{/if}
		{/if}
	{/each}
</g>
