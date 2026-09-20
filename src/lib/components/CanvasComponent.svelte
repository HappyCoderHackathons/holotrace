<script lang="ts">
	import type { CircuitComponent } from '$lib/types';
	import ComponentGlyph from './ComponentGlyph.svelte';

	interface Props {
		component: CircuitComponent;
		selected?: boolean;
		lit?: boolean;
		active?: boolean;
		editable?: boolean;
		showLabels?: boolean;
		schematic?: boolean;
		onpointerdown?: (event: PointerEvent) => void;
		onclick?: (event: MouseEvent) => void;
		onPinPointerDown?: (event: PointerEvent, pinId: string) => void;
		onPinPointerUp?: (event: PointerEvent, pinId: string) => void;
	}

	let {
		component,
		selected = false,
		lit = false,
		active = false,
		editable = false,
		showLabels = true,
		schematic = false,
		onpointerdown = () => {},
		onclick = () => {},
		onPinPointerDown = () => {},
		onPinPointerUp = () => {}
	}: Props = $props();

	const mirrorScale = $derived(component.mirrored ? -1 : 1);
</script>

<g
	transform={`translate(${component.x} ${component.y}) rotate(${component.rotation}) scale(${mirrorScale} 1)`}
	class={editable ? 'cursor-grab active:cursor-grabbing' : schematic ? '' : 'cursor-pointer'}
	role="button"
	tabindex="0"
	aria-label={`${component.label} ${component.refId}`}
	aria-pressed={selected}
	{onpointerdown}
	{onclick}
	onkeydown={(e) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			onclick(e as unknown as MouseEvent);
		}
	}}
>
	{#if selected}
		<rect x="-38" y="-24" width="76" height="48" rx="10" fill="none" stroke="#2563eb" stroke-width="1.5" stroke-dasharray="4 3" />
	{/if}
	<ComponentGlyph type={component.type} color={component.color} {lit} {active} {schematic} />

	{#if showLabels}
		<g transform={`rotate(${-component.rotation}) scale(${mirrorScale} 1)`}>
			<text
				x="0"
				y={schematic ? -30 : -42}
				text-anchor="middle"
				font-size={schematic ? 12 : 11}
				font-weight="600"
				fill={schematic ? '#94a3b8' : '#27313b'}
				paint-order="stroke"
				stroke="#f8fafc"
				stroke-width={schematic ? 0 : 5}
				class="select-none"
			>
				{component.refId}
			</text>
			{#if component.value}
				<text
					x="0"
					y={schematic ? 36 : 44}
					text-anchor="middle"
					font-size={schematic ? 11 : 10}
					fill="#94a3b8"
					paint-order="stroke"
					stroke="#f8fafc"
					stroke-width={schematic ? 0 : 4}
					class="select-none"
				>
					{component.value}
				</text>
			{/if}
		</g>
	{/if}

	{#each component.pins as pin (pin.id)}
		<circle
			cx={pin.x}
			cy={pin.y}
			r={editable ? 6 : 3}
			fill={editable ? '#64748b' : '#9aa5b1'}
			class:cursor-crosshair={editable}
			class="pin-dot"
			data-pin-id={pin.id}
			role="presentation"
			onpointerdown={(event) => {
				event.stopPropagation();
				onPinPointerDown(event, pin.id);
			}}
			onpointerup={(event) => {
				event.stopPropagation();
				onPinPointerUp(event, pin.id);
			}}
		/>
	{/each}
</g>
