import type { CircuitComponent } from './types';

export interface Point {
	x: number;
	y: number;
}

/**
 * Resolve a pin's position in canvas coordinates, applying the owning
 * component's mirror and rotation transforms to the pin's local offset.
 * Returns null when the component or pin no longer exists.
 */
export function pinWorldPos(
	components: CircuitComponent[],
	componentId: string,
	pinId: string
): Point | null {
	const comp = components.find((c) => c.id === componentId);
	if (!comp) return null;
	const pin = comp.pins.find((p) => p.id === pinId);
	if (!pin) return null;

	const rad = (comp.rotation * Math.PI) / 180;
	const px = pin.x * (comp.mirrored ? -1 : 1);
	const py = pin.y;
	return {
		x: comp.x + px * Math.cos(rad) - py * Math.sin(rad),
		y: comp.y + px * Math.sin(rad) + py * Math.cos(rad)
	};
}
