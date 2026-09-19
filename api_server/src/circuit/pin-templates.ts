import type { PinRole, Point } from './types';

export interface PinTemplate {
	key: string;
	name: string;
	electricalRole: PinRole;
	position: Point;
}

const twoTerminal: PinTemplate[] = [
	{ key: 'a', name: 'A', electricalRole: 'passive', position: { x: -0.5, y: 0 } },
	{ key: 'b', name: 'B', electricalRole: 'passive', position: { x: 0.5, y: 0 } }
];

const twoInputGate: PinTemplate[] = [
	{ key: 'input_a', name: 'A', electricalRole: 'input', position: { x: -0.5, y: -0.24 } },
	{ key: 'input_b', name: 'B', electricalRole: 'input', position: { x: -0.5, y: 0.24 } },
	{ key: 'output', name: 'Y', electricalRole: 'output', position: { x: 0.5, y: 0 } }
];

const templates: Record<string, PinTemplate[]> = {
	resistor: twoTerminal,
	'resistor.adjustable': [
		...twoTerminal,
		{ key: 'wiper', name: 'Wiper', electricalRole: 'control', position: { x: 0, y: -0.5 } }
	],
	'capacitor.unpolarized': twoTerminal,
	'capacitor.polarized': [
		{ key: 'positive', name: '+', electricalRole: 'passive', position: { x: -0.5, y: 0 } },
		{ key: 'negative', name: '-', electricalRole: 'passive', position: { x: 0.5, y: 0 } }
	],
	inductor: twoTerminal,
	diode: [
		{ key: 'anode', name: 'Anode', electricalRole: 'passive', position: { x: -0.5, y: 0 } },
		{ key: 'cathode', name: 'Cathode', electricalRole: 'passive', position: { x: 0.5, y: 0 } }
	],
	'diode.light_emitting': twoTerminal,
	'diode.zener': twoTerminal,
	switch: twoTerminal,
	fuse: twoTerminal,
	lamp: twoTerminal,
	motor: twoTerminal,
	speaker: twoTerminal,
	crystal: twoTerminal,
	and: twoInputGate,
	nand: twoInputGate,
	or: twoInputGate,
	nor: twoInputGate,
	xor: twoInputGate,
	not: [
		{ key: 'input', name: 'A', electricalRole: 'input', position: { x: -0.5, y: 0 } },
		{ key: 'output', name: 'Y', electricalRole: 'output', position: { x: 0.5, y: 0 } }
	],
	operational_amplifier: [
		{ key: 'inverting', name: '-', electricalRole: 'input', position: { x: -0.5, y: 0.24 } },
		{ key: 'non_inverting', name: '+', electricalRole: 'input', position: { x: -0.5, y: -0.24 } },
		{ key: 'output', name: 'Output', electricalRole: 'output', position: { x: 0.5, y: 0 } }
	],
	'transistor.bjt': [
		{ key: 'base', name: 'Base', electricalRole: 'control', position: { x: -0.5, y: 0 } },
		{ key: 'collector', name: 'Collector', electricalRole: 'passive', position: { x: 0.35, y: -0.5 } },
		{ key: 'emitter', name: 'Emitter', electricalRole: 'passive', position: { x: 0.35, y: 0.5 } }
	],
	'transistor.fet': [
		{ key: 'gate', name: 'Gate', electricalRole: 'control', position: { x: -0.5, y: 0 } },
		{ key: 'drain', name: 'Drain', electricalRole: 'passive', position: { x: 0.35, y: -0.5 } },
		{ key: 'source', name: 'Source', electricalRole: 'passive', position: { x: 0.35, y: 0.5 } }
	],
	'voltage.dc': [
		{ key: 'positive', name: '+', electricalRole: 'power', position: { x: 0, y: -0.5 } },
		{ key: 'negative', name: '-', electricalRole: 'ground', position: { x: 0, y: 0.5 } }
	],
	'voltage.battery': [
		{ key: 'positive', name: '+', electricalRole: 'power', position: { x: 0, y: -0.5 } },
		{ key: 'negative', name: '-', electricalRole: 'ground', position: { x: 0, y: 0.5 } }
	],
	gnd: [{ key: 'ground', name: 'Ground', electricalRole: 'ground', position: { x: 0, y: -0.5 } }],
	terminal: [{ key: 'terminal', name: 'Terminal', electricalRole: 'unknown', position: { x: 0, y: 0 } }]
};

const nonComponentLabels = new Set(['background', 'text', 'junction', 'crossover']);

export function isComponentLabel(label: string): boolean {
	return !nonComponentLabels.has(label);
}

export function getPinTemplate(label: string): readonly PinTemplate[] | undefined {
	return templates[label];
}
