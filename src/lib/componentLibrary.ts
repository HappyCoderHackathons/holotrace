import type { ComponentType, Pin } from './types';
import { genericPins, partByType } from './diagram/parts';

export interface PaletteItem {
	type: ComponentType;
	label: string;
	category: 'Basic' | 'Power' | 'Input' | 'Logic' | 'Other';
	defaultValue?: string;
	defaultColor?: string;
}

export const PALETTE: PaletteItem[] = [
	{ type: 'resistor', label: 'Resistor', category: 'Basic', defaultValue: '220Ω' },
	{ type: 'led', label: 'LED', category: 'Basic', defaultValue: '2V', defaultColor: '#e11d2e' },
	{ type: 'diode', label: 'Diode', category: 'Basic' },
	{ type: 'lamp', label: 'Lamp', category: 'Basic' },
	{ type: 'pushbutton', label: 'Pushbutton', category: 'Input' },
	{ type: 'switch', label: 'Slide Switch', category: 'Input' },
	{ type: 'capacitor', label: 'Capacitor', category: 'Basic', defaultValue: '10µF' },
	{ type: 'potentiometer', label: 'Potentiometer', category: 'Basic', defaultValue: '10kΩ' },
	{ type: 'battery', label: 'Coin Cell 3V', category: 'Power', defaultValue: '3V' },
	{ type: 'ac-source', label: 'AC Source', category: 'Power' },
	{ type: 'ground', label: 'Ground', category: 'Power' },
	{ type: 'and', label: 'AND Gate', category: 'Logic' },
	{ type: 'or', label: 'OR Gate', category: 'Logic' },
	{ type: 'nand', label: 'NAND Gate', category: 'Logic' },
	{ type: 'nor', label: 'NOR Gate', category: 'Logic' },
	{ type: 'xor', label: 'XOR Gate', category: 'Logic' },
	{ type: 'not', label: 'NOT Gate', category: 'Logic' },
	{ type: 'terminal', label: 'Terminal', category: 'Other' },
	{ type: 'generic', label: 'Part', category: 'Other' }
];

/** Every known component type, for validating untrusted input such as drag payloads. */
export const COMPONENT_TYPES: readonly ComponentType[] = PALETTE.map((item) => item.type);

export const REF_PREFIX: Record<ComponentType, string> = Object.fromEntries(
	PALETTE.map((item) => [item.type, partByType(`holotrace-${item.type}`)?.refPrefix ?? 'X'])
) as Record<ComponentType, string>;

export const COMPONENT_DISPLAY_NAME: Record<ComponentType, string> = {
	battery: 'Coin Cell 3V Battery',
	led: 'LED',
	resistor: 'Resistor',
	switch: 'Slide Switch',
	capacitor: 'Capacitor',
	pushbutton: 'Pushbutton',
	potentiometer: 'Potentiometer',
	diode: 'Diode',
	lamp: 'Lamp',
	'ac-source': 'AC Source',
	ground: 'Ground',
	terminal: 'Terminal',
	and: 'AND Gate',
	or: 'OR Gate',
	nand: 'NAND Gate',
	nor: 'NOR Gate',
	xor: 'XOR Gate',
	not: 'NOT Gate',
	generic: 'Part'
};

/** The pins of a part, from the one catalog the diagram code uses. A generic part can have more than two. */
export function defaultPins(type: ComponentType, count?: number): Pin[] {
	const def = partByType(`holotrace-${type}`);
	const pins = type === 'generic' && count !== undefined && count > 2 ? genericPins(count) : (def?.pins ?? []);
	return pins.map((pin) => ({ id: pin.id, x: pin.x, y: pin.y, label: pin.label }));
}
