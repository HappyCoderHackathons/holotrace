<script lang="ts">
	import type { ComponentType } from '$lib/types';
	import { genericPins } from '$lib/diagram/parts';

	interface Props {
		type: ComponentType;
		color?: string;
		/** LED is conducting enough current to emit */
		lit?: boolean;
		/** switch closed / button pressed */
		active?: boolean;
		scale?: number;
		schematic?: boolean;
		/** text inside a generic part */
		label?: string;
		/** how many pins a generic part has */
		pinCount?: number;
	}

	let {
		type,
		color = undefined,
		lit = false,
		active = false,
		scale = 1,
		schematic = false,
		label = '',
		pinCount = 2
	}: Props = $props();

	const ledColor = $derived(color ?? '#e11d2e');
	const schematicStroke = '#b91c1c';
	const NEW_TYPES: ComponentType[] = [
		'diode', 'lamp', 'ac-source', 'ground', 'terminal', 'and', 'or', 'nand', 'nor', 'xor', 'not', 'generic'
	];
	/** Parts drawn the same way in both styles: only the colours change. */
	const stroke = $derived(schematic ? schematicStroke : '#1a2027');
	const lead = $derived(schematic ? schematicStroke : '#4b5563');
	const leadWidth = $derived(schematic ? 1.5 : 2);
	const genericPinList = $derived(genericPins(pinCount));
	const genericHalf = $derived(Math.max(16, Math.ceil(pinCount / 2) * 10 + 6));
	const gateBubble = $derived(type === 'nand' || type === 'nor');
</script>

<g transform={`scale(${scale})`}>
	{#if NEW_TYPES.includes(type)}
		{#if type === 'diode'}
			<line x1="-24" y1="0" x2="-10" y2="0" stroke={lead} stroke-width={leadWidth} />
			<line x1="10" y1="0" x2="24" y2="0" stroke={lead} stroke-width={leadWidth} />
			<path d="M -10 -10 L 10 0 L -10 10 Z" fill={schematic ? 'none' : '#e9ecef'} stroke={stroke} stroke-width="1.5" />
			<line x1="10" y1="-10" x2="10" y2="10" stroke={stroke} stroke-width="2.5" />
		{:else if type === 'lamp'}
			<line x1="-24" y1="0" x2="-14" y2="0" stroke={lead} stroke-width={leadWidth} />
			<line x1="14" y1="0" x2="24" y2="0" stroke={lead} stroke-width={leadWidth} />
			<circle cx="0" cy="0" r="14" fill={lit ? '#fde68a' : schematic ? 'none' : '#fffbeb'} stroke={stroke} stroke-width="1.5" />
			<path d="M -10 -10 L 10 10 M -10 10 L 10 -10" stroke={stroke} stroke-width="1.5" />
		{:else if type === 'ac-source'}
			<line x1="-24" y1="0" x2="-14" y2="0" stroke={lead} stroke-width={leadWidth} />
			<line x1="14" y1="0" x2="24" y2="0" stroke={lead} stroke-width={leadWidth} />
			<circle cx="0" cy="0" r="14" fill={schematic ? 'none' : '#f8fafc'} stroke={stroke} stroke-width="1.5" />
			<path d="M -8 0 Q -4 -9 0 0 T 8 0" fill="none" stroke={stroke} stroke-width="1.5" />
		{:else if type === 'ground'}
			<line x1="0" y1="-16" x2="0" y2="-4" stroke={lead} stroke-width={leadWidth} />
			<line x1="-12" y1="-4" x2="12" y2="-4" stroke={stroke} stroke-width="2" />
			<line x1="-8" y1="2" x2="8" y2="2" stroke={stroke} stroke-width="2" />
			<line x1="-4" y1="8" x2="4" y2="8" stroke={stroke} stroke-width="2" />
		{:else if type === 'terminal'}
			<circle cx="0" cy="0" r="5" fill={schematic ? 'none' : '#ffffff'} stroke={stroke} stroke-width="2" />
		{:else if type === 'not'}
			<line x1="-28" y1="0" x2="-16" y2="0" stroke={lead} stroke-width={leadWidth} />
			<line x1="18" y1="0" x2="28" y2="0" stroke={lead} stroke-width={leadWidth} />
			<path d="M -16 -12 L 12 0 L -16 12 Z" fill={schematic ? 'none' : '#e9ecef'} stroke={stroke} stroke-width="1.5" />
			<circle cx="15" cy="0" r="3" fill={schematic ? 'none' : '#ffffff'} stroke={stroke} stroke-width="1.5" />
		{:else if type === 'generic'}
			{#each genericPinList as pin (pin.id)}
				<line x1={pin.x} y1={pin.y} x2={pin.x > 0 ? 24 : -24} y2={pin.y} stroke={lead} stroke-width={leadWidth} />
			{/each}
			<rect x="-24" y={-genericHalf} width="48" height={genericHalf * 2} rx="3" fill={schematic ? 'none' : '#f1f5f9'} stroke={stroke} stroke-width="1.5" />
			<text x="0" y="3" text-anchor="middle" font-size="9" fill={stroke} class="select-none">{label.slice(0, 10)}</text>
		{:else}
			<!-- Logic gates: pins a and b on the left (a above b), y on the right -->
			<line x1="-28" y1="-10" x2="-19" y2="-10" stroke={lead} stroke-width={leadWidth} />
			<line x1="-28" y1="10" x2="-19" y2="10" stroke={lead} stroke-width={leadWidth} />
			<line x1={gateBubble ? 20 : 14} y1="0" x2="28" y2="0" stroke={lead} stroke-width={leadWidth} />
			{#if type === 'and' || type === 'nand'}
				<path d="M -20 -14 L 0 -14 A 14 14 0 0 1 0 14 L -20 14 Z" fill={schematic ? 'none' : '#e9ecef'} stroke={stroke} stroke-width="1.5" stroke-linejoin="round" />
			{:else}
				<path d="M -20 -14 Q -4 -14 14 0 Q -4 14 -20 14 Q -10 0 -20 -14 Z" fill={schematic ? 'none' : '#e9ecef'} stroke={stroke} stroke-width="1.5" stroke-linejoin="round" />
			{/if}
			{#if type === 'xor'}
				<path d="M -25 -14 Q -15 0 -25 14" fill="none" stroke={stroke} stroke-width="1.5" />
			{/if}
			{#if gateBubble}
				<circle cx="17" cy="0" r="3" fill={schematic ? 'none' : '#ffffff'} stroke={stroke} stroke-width="1.5" />
			{/if}
		{/if}
	{:else if schematic}
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
