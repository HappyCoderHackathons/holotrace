import { readable, writable } from 'svelte/store';
import { browser } from '$app/environment';

/**
 * Presentation state for the application shell. Kept separate from the
 * circuit store so that chrome layout never participates in undo history.
 */

/** A bottom sheet on compact layouts. Only one can be open at a time. */
export type Sheet = 'sketch' | 'parts' | 'tools' | null;

export const activeSheet = writable<Sheet>(null);

export function openSheet(sheet: Exclude<Sheet, null>) {
	activeSheet.set(sheet);
}

export function closeSheet() {
	activeSheet.set(null);
}

/** Desktop side panels. Ignored on compact layouts, where sheets take over. */
export const sketchPanelOpen = writable<boolean>(true);
export const partsPanelOpen = writable<boolean>(true);

/**
 * A media query as a store. Returns `initial` during SSR and on the first
 * client render so hydration does not mismatch, then settles on the real
 * value. Listener is torn down when the last subscriber leaves.
 */
function mediaQuery(query: string, initial: boolean) {
	return readable(initial, (set) => {
		if (!browser) return;
		const list = window.matchMedia(query);
		set(list.matches);
		const onChange = (e: MediaQueryListEvent) => set(e.matches);
		list.addEventListener('change', onChange);
		return () => list.removeEventListener('change', onChange);
	});
}

/** Phone-sized: the three-column shell collapses to a single canvas. */
export const isCompact = mediaQuery('(max-width: 767px)', false);

/** Tablet and narrow desktop: the toolbar cannot fit on one row. */
export const isNarrow = mediaQuery('(max-width: 1100px)', false);

/**
 * Touch or pen as the primary input. Drives hit-target sizing and the
 * tap-tap wiring flow, which are about finger precision rather than width.
 */
export const isCoarsePointer = mediaQuery('(pointer: coarse)', false);

export const prefersReducedMotion = mediaQuery('(prefers-reduced-motion: reduce)', false);
