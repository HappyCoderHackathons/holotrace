import type { CircuitComponent, CircuitState, Wire } from './types';
import { defaultPins } from './componentLibrary';
import { createId } from './id';

/**
 * Simulates parsing a hand-drawn circuit sketch into a digital circuit.
 * In a production build this would call a vision model / CV pipeline.
 * Here we produce a plausible LED + resistor + battery loop so the
 * View / Demo / Edit flow is fully exercisable end-to-end.
 */
export async function parseSketch(imageDataUrl: string): Promise<CircuitState> {
	// simulate processing latency
	await new Promise((r) => setTimeout(r, 1400));

	const battery: CircuitComponent = {
		id: createId(),
		refId: 'BAT1',
		type: 'battery',
		label: 'Coin Cell 3V Battery',
		x: 440,
		y: 380,
		rotation: 0,
		mirrored: false,
		value: '3V',
		pins: defaultPins('battery')
	};
	const resistor: CircuitComponent = {
		id: createId(),
		refId: 'R1',
		type: 'resistor',
		label: 'Resistor',
		x: 440,
		y: 240,
		rotation: 90,
		mirrored: false,
		value: '220Ω',
		pins: defaultPins('resistor')
	};
	const led: CircuitComponent = {
		id: createId(),
		refId: 'D1',
		type: 'led',
		label: 'LED',
		x: 440,
		y: 130,
		rotation: 90,
		mirrored: false,
		value: 'Red',
		color: '#e11d2e',
		pins: defaultPins('led')
	};

	const wires: Wire[] = [
		{
			id: createId(),
			fromComponentId: battery.id,
			fromPinId: 'pos',
			toComponentId: led.id,
			toPinId: 'k',
			color: '#22c55e',
			style: 'solid',
			waypoints: [
				{ x: 320, y: 380 },
				{ x: 320, y: 130 }
			]
		},
		{
			id: createId(),
			fromComponentId: led.id,
			fromPinId: 'a',
			toComponentId: resistor.id,
			toPinId: '2',
			color: '#22c55e',
			style: 'solid'
		},
		{
			id: createId(),
			fromComponentId: resistor.id,
			fromPinId: '1',
			toComponentId: battery.id,
			toPinId: 'neg',
			color: '#111827',
			style: 'solid',
			waypoints: [
				{ x: 560, y: 240 },
				{ x: 560, y: 380 }
			]
		}
	];

	return {
		components: [battery, resistor, led],
		wires,
		detection: {
			sourceImage: imageDataUrl,
			status: 'Circuit detected: LED + resistor + coin cell battery',
			detectedAt: Date.now()
		}
	};
}

export function readFileAsDataUrl(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = reject;
		reader.readAsDataURL(file);
	});
}
