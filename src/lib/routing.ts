// How a wire is drawn: only at right angles. A wire says what it connects; this works out the line.
//
// Each pin gets a short straight stub out of its component (the way it faces), then the wire turns at 90° corners
// to the other end. Corners the user has pulled the wire through (waypoints) are kept, with right-angle elbows
// between them, so an edited wire stays where it was put.

import type { Point } from './geometry';

/** How far a wire runs straight out of a pin before it may turn. */
export const STUB = 16;

/** Points closer than this on an axis count as level: parts sit on fractions of a unit, and a hair's width is not a corner. */
const LEVEL = 0.5;
const level = (a: number, b: number) => Math.abs(a - b) < LEVEL;
const same = (a: Point, b: Point) => level(a.x, b.x) && level(a.y, b.y);
const dot = (a: Point, b: Point) => a.x * b.x + a.y * b.y;
const step = (from: Point, to: Point): Point => ({ x: Math.sign(to.x - from.x), y: Math.sign(to.y - from.y) });

/**
 * The corner between two points, going horizontal first or vertical first: the one that doesn't fold back over the
 * stub it leaves (`leaving`, the way the wire is already heading) or double back into the stub it arrives by
 * (`arriving`, the way the last stub faces).
 */
function elbow(a: Point, b: Point, leaving: Point | null, arriving: Point | null): Point[] {
	if (level(a.x, b.x) || level(a.y, b.y)) return [];
	const options: Point[] = [
		{ x: b.x, y: a.y },
		{ x: a.x, y: b.y }
	];
	const cost = (corner: Point) => {
		let c = 0;
		const first = step(a, corner);
		const last = step(corner, b);
		if (leaving && dot(first, leaving) < 0) c += 4;
		if (arriving && dot(last, arriving) > 0) c += 4;
		return c;
	};
	return [cost(options[0]) <= cost(options[1]) ? options[0] : options[1]];
}

/** Drops repeated points, and points in the middle of a straight run. */
function tidy(points: Point[]): Point[] {
	const distinct = points.filter((p, i) => i === 0 || !same(p, points[i - 1]));
	return distinct.filter((p, i) => {
		if (i === 0 || i === distinct.length - 1) return true;
		const a = distinct[i - 1];
		const b = distinct[i + 1];
		return !((level(a.x, p.x) && level(p.x, b.x)) || (level(a.y, p.y) && level(p.y, b.y)));
	});
}

/**
 * The corners of a wire from `from` to `to`, as points to join with straight lines. `facing` is the way an end faces
 * out of its part (null for a junction, which faces nowhere). Every segment is horizontal or vertical.
 */
export function routeWire(
	from: { at: Point; facing: Point | null },
	to: { at: Point; facing: Point | null },
	waypoints: Point[] = []
): Point[] {
	const start = from.facing ? { x: from.at.x + from.facing.x * STUB, y: from.at.y + from.facing.y * STUB } : from.at;
	const finish = to.facing ? { x: to.at.x + to.facing.x * STUB, y: to.at.y + to.facing.y * STUB } : to.at;

	const path: Point[] = [from.at];
	if (from.facing) path.push(start);
	const via = [...waypoints, finish];
	let heading: Point | null = from.facing;
	let here = start;
	via.forEach((next, n) => {
		const last = n === via.length - 1;
		const corners = elbow(here, next, heading, last ? to.facing : null);
		path.push(...corners, next);
		heading = step(corners.length ? corners[corners.length - 1] : here, next);
		here = next;
	});
	if (to.facing) path.push(to.at);
	return tidy(path);
}

/**
 * Takes out the places where a path doubles back on itself (it runs along a line, turns straight round and runs
 * back over it), which is what pulling a corner past the next one leaves behind. What was a spike is straightened.
 */
export function collapseRoute(points: Point[]): Point[] {
	let path = tidy(points);
	for (let changed = true; changed; ) {
		changed = false;
		for (let i = 1; i < path.length - 1; i++) {
			const [a, b, c] = [path[i - 1], path[i], path[i + 1]];
			const ab = { x: b.x - a.x, y: b.y - a.y };
			const bc = { x: c.x - b.x, y: c.y - b.y };
			// Straight back over itself, give or take a pen-width (a fold a few units wide is the same fold).
			const narrow = Math.abs(ab.x * bc.y - ab.y * bc.x) <= 6 * Math.min(Math.hypot(ab.x, ab.y), Math.hypot(bc.x, bc.y));
			if (narrow && dot(ab, bc) < 0) {
				path = tidy([...path.slice(0, i), ...path.slice(i + 1)]);
				changed = true;
				break;
			}
		}
	}
	return path;
}

/** The points where the router ends the stubs out of the pins (none for a junction end). */
export function stubPoints(
	from: { at: Point; facing: Point | null },
	to: { at: Point; facing: Point | null }
): Point[] {
	return [from, to].flatMap((end) => (end.facing ? [{ x: end.at.x + end.facing.x * STUB, y: end.at.y + end.facing.y * STUB }] : []));
}

/** Whether two points are the same, give or take a hair. */
export const samePoint = same;

/**
 * The corners of a route that belong to the wire (the ones a person pulled it through), not the ones the router adds
 * itself (the ends, and the short stub out of a pin). `at[k]` is where corner k sits in `route`. Setting a wire's waypoints
 * to `corners` reproduces the route, and the wire still follows its parts when they move.
 */
export function storedCorners(
	route: Point[],
	from: { at: Point; facing: Point | null },
	to: { at: Point; facing: Point | null }
): { corners: Point[]; at: number[] } {
	const stubs = stubPoints(from, to);
	const corners: Point[] = [];
	const at: number[] = [];
	for (let i = 1; i < route.length - 1; i++) {
		if (stubs.some((stub) => same(stub, route[i]))) continue;
		corners.push({ x: route[i].x, y: route[i].y });
		at.push(i);
	}
	return { corners, at };
}

/** Where a new corner on segment `segment` of a route goes among the stored corners. */
export function insertIndex(at: number[], segment: number): number {
	return at.filter((index) => index <= segment).length;
}

/** The path as SVG `d`. */
export function pathData(points: Point[]): string {
	return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
}

/** The point halfway along a path, for putting a label or a new corner. */
export function midpoint(points: Point[]): Point {
	let total = 0;
	for (let i = 1; i < points.length; i++) total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
	let left = total / 2;
	for (let i = 1; i < points.length; i++) {
		const len = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
		if (left <= len && len > 0) {
			const t = left / len;
			return { x: points[i - 1].x + (points[i].x - points[i - 1].x) * t, y: points[i - 1].y + (points[i].y - points[i - 1].y) * t };
		}
		left -= len;
	}
	return points[0];
}

/** Snaps a point to a grid, so dragged corners land tidily. */
export function snap(point: Point, grid = 8): Point {
	return { x: Math.round(point.x / grid) * grid, y: Math.round(point.y / grid) * grid };
}

/** Which segment of a path (0 is the one from the first point to the second) lies closest to `point`. */
export function nearestSegment(points: Point[], point: Point): number {
	let best = 0;
	let bestDistance = Infinity;
	for (let i = 1; i < points.length; i++) {
		const a = points[i - 1];
		const b = points[i];
		const lengthSquared = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
		const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y)) / lengthSquared));
		const d = Math.hypot(a.x + (b.x - a.x) * t - point.x, a.y + (b.y - a.y) * t - point.y);
		if (d < bestDistance) {
			bestDistance = d;
			best = i - 1;
		}
	}
	return best;
}

/** The point on a path closest to `point`, for dropping a junction onto a wire. */
export function nearestOnPath(points: Point[], point: Point): Point {
	let best = points[0];
	let bestDistance = Infinity;
	for (let i = 1; i < points.length; i++) {
		const a = points[i - 1];
		const b = points[i];
		const lengthSquared = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
		const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y)) / lengthSquared));
		const candidate = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
		const d = Math.hypot(candidate.x - point.x, candidate.y - point.y);
		if (d < bestDistance) {
			bestDistance = d;
			best = candidate;
		}
	}
	return best;
}
