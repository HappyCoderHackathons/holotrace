import type { CircuitComponent, WireEnd, WireNode } from './types';

export interface Point {
	x: number;
	y: number;
}

/** A pin's local offset with the component's mirror and rotation applied. */
function turnedOffset(comp: CircuitComponent, x: number, y: number): Point {
	const rad = (comp.rotation * Math.PI) / 180;
	const px = x * (comp.mirrored ? -1 : 1);
	return {
		x: px * Math.cos(rad) - y * Math.sin(rad),
		y: px * Math.sin(rad) + y * Math.cos(rad)
	};
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
	const offset = turnedOffset(comp, pin.x, pin.y);
	return { x: comp.x + offset.x, y: comp.y + offset.y };
}

/** The axis direction a pin faces out of its component (a unit step), or null for a pin at the centre. */
export function pinOutward(
	components: CircuitComponent[],
	componentId: string,
	pinId: string
): Point | null {
	const comp = components.find((c) => c.id === componentId);
	const pin = comp?.pins.find((p) => p.id === pinId);
	if (!comp || !pin) return null;
	const { x, y } = turnedOffset(comp, pin.x, pin.y);
	if (Math.hypot(x, y) < 1) return null;
	return Math.abs(x) >= Math.abs(y) ? { x: Math.sign(x), y: 0 } : { x: 0, y: Math.sign(y) };
}

/** Where a wire end is on the canvas, and which way it faces (a pin faces out of its component; a node faces nowhere). */
export function endPoint(
	components: CircuitComponent[],
	nodes: WireNode[],
	end: WireEnd
): { at: Point; facing: Point | null } | null {
	if ('nodeId' in end) {
		const node = nodes.find((n) => n.id === end.nodeId);
		return node ? { at: { x: node.x, y: node.y }, facing: null } : null;
	}
	const at = pinWorldPos(components, end.componentId, end.pinId);
	return at ? { at, facing: pinOutward(components, end.componentId, end.pinId) } : null;
}

export function sameEnd(a: WireEnd, b: WireEnd): boolean {
	if ('nodeId' in a || 'nodeId' in b) return 'nodeId' in a && 'nodeId' in b && a.nodeId === b.nodeId;
	return a.componentId === b.componentId && a.pinId === b.pinId;
}

/** A stable text key for a wire end, for maps and graphs. */
export function endKey(end: WireEnd): string {
	return 'nodeId' in end ? `node:${end.nodeId}` : `${end.componentId}:${end.pinId}`;
}
