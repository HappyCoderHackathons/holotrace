<script lang="ts">
	import type { ComponentType } from '$lib/types';

	interface Props {
		type: ComponentType;
		color?: string;
		/** LED is conducting enough current to emit */
		lit?: boolean;
		/** switch closed / button pressed */
		active?: boolean;
		scale?: number;
		schematic?: boolean;
	}

	let {
		type,
		color = undefined,
		lit = false,
		active = false,
		scale = 1,
		schematic = false
	}: Props = $props();

	const ledColor = $derived(color ?? '#e11d2e');
	const schematicStroke = '#b91c1c';
</script>

<g transform={`scale(${scale})`}>
	{#if schematic}
		<!-- Pure schematic (IEEE-style) symbols: thin colored strokes, no pictorial fills -->
		{#if type === 'resistor'}
			<line x1="-32" y1="0" x2="-20" y2="0" stroke={schematicStroke} stroke-width="1.5" />
			<line x1="20" y1="0" x2="32" y2="0" stroke={schematicStroke} stroke-width="1.5" />
			<path
				d="M -20 0 L -16 -8 L -10 8 L -4 -8 L 2 8 L 8 -8 L 14 8 L 20 0"
				fill="none"
				stroke={schematicStroke}
				stroke-width="1.5"
				stroke-linejoin="round"
			/>
		{:else if type === 'led'}
			<line x1="-32" y1="0" x2="-9" y2="0" stroke={schematicStroke} stroke-width="1.5" />
			<line x1="9" y1="0" x2="32" y2="0" stroke={schematicStroke} stroke-width="1.5" />
			<path d="M -9 -9 L 9 0 L -9 9 Z" fill="none" stroke={schematicStroke} stroke-width="1.5" />
			<line x1="9" y1="-9" x2="9" y2="9" stroke={schematicStroke} stroke-width="1.5" />
			<path
				d="M 3 -16 L 9 -22 M 9 -16 L 15 -22"
				stroke={schematicStroke}
				stroke-width="1.3"
				stroke-linecap="round"
			/>
			<path
				d="M 9 -12 L 15 -18 M 15 -12 L 21 -18"
				stroke={schematicStroke}
				stroke-width="1.3"
				stroke-linecap="round"
			/>
		{:else if type === 'battery'}
			<line x1="-32" y1="0" x2="-9" y2="0" stroke={schematicStroke} stroke-width="1.5" />
			<line x1="9" y1="0" x2="32" y2="0" stroke={schematicStroke} stroke-width="1.5" />
			<line x1="-9" y1="-13" x2="-9" y2="13" stroke={schematicStroke} stroke-width="3" />
			<line x1="0" y1="-7" x2="0" y2="7" stroke={schematicStroke} stroke-width="1.5" />
			<line x1="9" y1="-15" x2="9" y2="15" stroke={schematicStroke} stroke-width="3" />
			<text x="-19" y="-9" font-size="10" fill={schematicStroke} font-weight="600">+</text>
			<text x="12" y="-9" font-size="10" fill={schematicStroke} font-weight="600">−</text>
		{:else if type === 'capacitor'}
			<line x1="-32" y1="0" x2="-5" y2="0" stroke={schematicStroke} stroke-width="1.5" />
			<line x1="5" y1="0" x2="32" y2="0" stroke={schematicStroke} stroke-width="1.5" />
			<line x1="-5" y1="-13" x2="-5" y2="13" stroke={schematicStroke} stroke-width="2.5" />
			<line x1="5" y1="-13" x2="5" y2="13" stroke={schematicStroke} stroke-width="2.5" />
		{:else if type === 'switch' || type === 'pushbutton'}
			<line x1="-32" y1="0" x2="-14" y2="0" stroke={schematicStroke} stroke-width="1.5" />
			<line x1="14" y1="0" x2="32" y2="0" stroke={schematicStroke} stroke-width="1.5" />
			<circle cx="-14" cy="0" r="2" fill={schematicStroke} />
			<circle cx="14" cy="0" r="2" fill={schematicStroke} />
			{#if active}
				<line x1="-14" y1="0" x2="14" y2="0" stroke={schematicStroke} stroke-width="1.5" />
			{:else}
				<line x1="-14" y1="0" x2="11" y2="-13" stroke={schematicStroke} stroke-width="1.5" />
			{/if}
			<path d="M -18 -16 L -18 -6 L -8 -6" fill="none" stroke={schematicStroke} stroke-width="1.3" />
		{:else if type === 'potentiometer'}
			<line x1="-32" y1="0" x2="-20" y2="0" stroke={schematicStroke} stroke-width="1.5" />
			<line x1="20" y1="0" x2="32" y2="0" stroke={schematicStroke} stroke-width="1.5" />
			<rect x="-20" y="-8" width="40" height="16" fill="none" stroke={schematicStroke} stroke-width="1.5" />
			<line x1="0" y1="-22" x2="0" y2="-8" stroke={schematicStroke} stroke-width="1.5" />
			<path
				d="M -6 -22 L 4 -22 L 0 -14 Z"
				fill={schematicStroke}
				stroke={schematicStroke}
				stroke-width="1"
			/>
		{/if}
	{:else if type === 'resistor'}
		<rect x="-20" y="-8" width="40" height="16" rx="3" fill="#fdf6e3" stroke="#8a6d1d" stroke-width="1.5" />
		<rect x="-15" y="-8" width="4" height="16" fill="#c0392b" />
		<rect x="-8" y="-8" width="4" height="16" fill="#8a6d1d" />
		<rect x="0" y="-8" width="4" height="16" fill="#c0392b" />
		<line x1="-32" y1="0" x2="-20" y2="0" stroke="#4b5563" stroke-width="2" />
		<line x1="20" y1="0" x2="32" y2="0" stroke="#4b5563" stroke-width="2" />
	{:else if type === 'led'}
		<line x1="-32" y1="0" x2="-14" y2="0" stroke="#4b5563" stroke-width="2" />
		<line x1="14" y1="0" x2="32" y2="0" stroke="#4b5563" stroke-width="2" />
		<g class={lit ? 'led-glow' : ''} style={lit ? `color:${ledColor}` : ''}>
			<path
				d="M -14 -12 L 10 0 L -14 12 Z"
				fill={lit ? ledColor : '#f3d4d6'}
				stroke={lit ? ledColor : '#8a3b40'}
				stroke-width="1.5"
			/>
			<line x1="10" y1="-12" x2="10" y2="12" stroke={lit ? ledColor : '#8a3b40'} stroke-width="2" />
			<line x1="14" y1="-12" x2="14" y2="12" stroke={lit ? ledColor : '#8a3b40'} stroke-width="2" />
		</g>
		{#if lit}
			<path d="M 4 -18 L 10 -24 M 10 -18 L 16 -24" stroke={ledColor} stroke-width="1.5" stroke-linecap="round" />
		{/if}
	{:else if type === 'battery'}
		<line x1="-32" y1="0" x2="-10" y2="0" stroke="#4b5563" stroke-width="2" />
		<line x1="10" y1="0" x2="32" y2="0" stroke="#4b5563" stroke-width="2" />
		<line x1="-10" y1="-14" x2="-10" y2="14" stroke="#1a2027" stroke-width="3" />
		<line x1="0" y1="-8" x2="0" y2="8" stroke="#1a2027" stroke-width="1.5" />
		<line x1="10" y1="-16" x2="10" y2="16" stroke="#1a2027" stroke-width="3" />
		<text x="-20" y="-10" font-size="11" fill="#1a2027" font-weight="600">+</text>
		<text x="14" y="-10" font-size="11" fill="#1a2027" font-weight="600">−</text>
	{:else if type === 'capacitor'}
		<line x1="-32" y1="0" x2="-6" y2="0" stroke="#4b5563" stroke-width="2" />
		<line x1="6" y1="0" x2="32" y2="0" stroke="#4b5563" stroke-width="2" />
		<line x1="-6" y1="-14" x2="-6" y2="14" stroke="#1a2027" stroke-width="3" />
		<line x1="6" y1="-14" x2="6" y2="14" stroke="#1a2027" stroke-width="3" />
	{:else if type === 'switch' || type === 'pushbutton'}
		<line x1="-32" y1="0" x2="-14" y2="0" stroke="#4b5563" stroke-width="2" />
		<line x1="14" y1="0" x2="32" y2="0" stroke="#4b5563" stroke-width="2" />
		<circle cx="-14" cy="0" r="2.5" fill={active ? '#16a34a' : '#4b5563'} />
		<circle cx="14" cy="0" r="2.5" fill={active ? '#16a34a' : '#4b5563'} />
		{#if active}
			<line x1="-14" y1="0" x2="14" y2="0" stroke="#16a34a" stroke-width="2" />
		{:else}
			<line x1="-14" y1="0" x2="12" y2="-14" stroke="#4b5563" stroke-width="2" />
		{/if}
	{:else if type === 'potentiometer'}
		<line x1="-32" y1="0" x2="-14" y2="0" stroke="#4b5563" stroke-width="2" />
		<line x1="14" y1="0" x2="32" y2="0" stroke="#4b5563" stroke-width="2" />
		<line x1="0" y1="-32" x2="0" y2="-14" stroke="#4b5563" stroke-width="2" />
		<rect x="-14" y="-8" width="28" height="16" rx="2" fill="#e9ecef" stroke="#4b5563" stroke-width="1.5" />
		<path d="M -8 -14 L 0 -6 L 8 -14" fill="none" stroke="#4b5563" stroke-width="1.5" />
	{/if}
</g>
