import type { ComponentType, Pin } from './types';

export interface PaletteItem {
	type: ComponentType;
	label: string;
	category: 'Basic' | 'Power' | 'Input';
	defaultValue?: string;
	defaultColor?: string;
}

export const PALETTE: PaletteItem[] = [
	{ type: 'resistor', label: 'Resistor', category: 'Basic', defaultValue: '220Ω' },
	{ type: 'led', label: 'LED', category: 'Basic', defaultValue: '2V', defaultColor: '#e11d2e' },
	{ type: 'pushbutton', label: 'Pushbutton', category: 'Input' },
	{ type: 'switch', label: 'Slide Switch', category: 'Input' },
	{ type: 'capacitor', label: 'Capacitor', category: 'Basic', defaultValue: '10µF' },
	{ type: 'potentiometer', label: 'Potentiometer', category: 'Basic', defaultValue: '10kΩ' },
	{ type: 'battery', label: 'Coin Cell 3V', category: 'Power', defaultValue: '3V' }
];

/** Every known component type, for validating untrusted input such as drag payloads. */
export const COMPONENT_TYPES: readonly ComponentType[] = [
	'battery',
	'led',
	'resistor',
	'switch',
	'capacitor',
	'pushbutton',
	'potentiometer'
];

export const REF_PREFIX: Record<ComponentType, string> = {
	battery: 'BAT',
	led: 'D',
	resistor: 'R',
	switch: 'SW',
	capacitor: 'C',
	pushbutton: 'SW',
	potentiometer: 'POT'
};

export const COMPONENT_DISPLAY_NAME: Record<ComponentType, string> = {
	battery: 'Coin Cell 3V Battery',
	led: 'LED',
	resistor: 'Resistor',
	switch: 'Slide Switch',
	capacitor: 'Capacitor',
	pushbutton: 'Pushbutton',
	potentiometer: 'Potentiometer'
};

/** Two-pin layout used by most basic through-hole style components */
export function defaultPins(type: ComponentType): Pin[] {
	switch (type) {
		case 'led':
			return [
				{ id: 'a', x: -24, y: 0, label: 'A' },
				{ id: 'k', x: 24, y: 0, label: 'K' }
			];
		case 'battery':
			return [
				{ id: 'pos', x: -28, y: 0, label: '+' },
				{ id: 'neg', x: 28, y: 0, label: '−' }
			];
		case 'potentiometer':
			return [
				{ id: '1', x: -24, y: 0, label: '1' },
				{ id: '2', x: 0, y: -22, label: '2' },
				{ id: '3', x: 24, y: 0, label: '3' }
			];
		default:
			return [
				{ id: '1', x: -24, y: 0, label: '1' },
				{ id: '2', x: 24, y: 0, label: '2' }
			];
	}
}
