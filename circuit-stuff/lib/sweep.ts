// The sweep for a pair (see src/lib/vision/candidates.ts and reconcile.ts): a grid of windows added to its
// request, judged and tightened with the ink of its image the way the app does.

import { toCorners } from "../../src/lib/vision/boxes";
import { evenlyThinned, gridWindows, SWEEP_ID_PREFIX } from "../../src/lib/vision/candidates";
import { MAX_PROPOSALS } from "../../src/lib/vision/config";
import type { ProposedRegion } from "../../src/lib/vision/reconcile";
import { tightenRegions, windowsWithInk } from "../../src/lib/vision/sweep";
import type { PairInk } from "./ink";
import type { LoadedPair } from "./load-pair";

export type Sweep = {
    // The pair with the windows added to its request.
    sent: LoadedPair;
    // The sweep windows among `regions` shrunk to the ink inside them.
    tighten: (regions: ProposedRegion[]) => ProposedRegion[];
    // What was done, for the console.
    note: string;
};

function withWindows(loaded: LoadedPair, windows: ReturnType<typeof gridWindows>): LoadedPair {
    const { request } = loaded;
    const kept = evenlyThinned(windows, MAX_PROPOSALS - request.regions.length);
    const regions = kept.map((box, n) => ({ id: `${SWEEP_ID_PREFIX}${n}`, box: toCorners(box), local_label: null, local_confidence: null }));
    const next = { ...request, regions: [...request.regions, ...regions] };
    return { ...loaded, request: next, requestText: JSON.stringify(next) };
}

// The sweep of a pair. With the image's ink (a PNG) it works as the app does: windows with no ink are not sent, and
// sweep windows are tightened to their ink before merging. Without it, every window is sent and left as it is.
export function startSweep(loaded: LoadedPair, ink: PairInk | { error: string }): Sweep {
    const { request, pair } = loaded;
    const all = gridWindows(request.image_width, request.image_height);
    if ("ink" in ink) {
        const windows = windowsWithInk(ink.ink, all);
        return { sent: withWindows(loaded, windows), tighten: (regions) => tightenRegions(ink.ink, regions), note: `${windows.length} of ${all.length} windows have ink and were sent` };
    }
    console.error(`warning: could not look at the ink of ${pair.name} (${ink.error}); sending every window`);
    return { sent: withWindows(loaded, all), tighten: (regions) => regions, note: `${all.length} windows sent, none filtered or tightened (no ink to look at)` };
}
