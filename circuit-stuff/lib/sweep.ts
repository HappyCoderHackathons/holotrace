// The sweep for a pair (see src/lib/vision/candidates.ts and reconcile.ts): a grid of windows added to its
// request, and the ink of its image so the windows can be judged and tightened the way the app does.

import { extname } from "node:path";
import { evenlyThinned, gridWindows, SWEEP_ID_PREFIX } from "../../src/lib/vision/candidates";
import { DETECT_WIDTH, MAX_PROPOSALS } from "../../src/lib/vision/config";
import { toCorners } from "../../src/lib/vision/boxes";
import type { ProposedRegion } from "../../src/lib/vision/reconcile";
import { whenOpenCvReady } from "./opencv";
import { state } from "../../src/lib/vision/state";
import { inkMask } from "../../src/lib/vision/ink";
import { tightenRegions, windowsWithInk } from "../../src/lib/vision/sweep";
import type { LoadedPair } from "./load-pair";
import { decodePng } from "./png";

export type Sweep = {
    // The pair with the windows added to its request.
    sent: LoadedPair;
    // The sweep windows among `regions` shrunk to the ink inside them.
    tighten: (regions: ProposedRegion[]) => ProposedRegion[];
    // What was done, for the console.
    note: string;
    // Frees the image's OpenCV data.
    close: () => void;
};

function withWindows(loaded: LoadedPair, windows: ReturnType<typeof gridWindows>): LoadedPair {
    const { request } = loaded;
    const kept = evenlyThinned(windows, MAX_PROPOSALS - request.regions.length);
    const regions = kept.map((box, n) => ({ id: `${SWEEP_ID_PREFIX}${n}`, box: toCorners(box), local_label: null, local_confidence: null }));
    const next = { ...request, regions: [...request.regions, ...regions] };
    return { ...loaded, request: next, requestText: JSON.stringify(next) };
}

// Prepares the sweep of a pair. For a PNG it looks at the ink, as the app does: windows with no ink are not
// sent, and sweep windows are tightened to their ink before merging. For any other image it sends every window
// and leaves them as they are.
export async function startSweep(loaded: LoadedPair): Promise<Sweep> {
    const { request, pair } = loaded;
    const all = gridWindows(request.image_width, request.image_height);
    if (extname(pair.imagePath).toLowerCase() === ".png") {
        try {
            const { width, height, rgba } = decodePng(loaded.image);
            const { cv } = await whenOpenCvReady();
            const source = new cv.Mat(height, width, cv.CV_8UC4);
            source.data.set(rgba);
            state.detectScale = Math.max(1, width / DETECT_WIDTH);
            state.capturedMask = null;
            const ink = inkMask(source);
            source.delete();
            const windows = windowsWithInk(ink, all);
            return {
                sent: withWindows(loaded, windows),
                tighten: (regions) => tightenRegions(ink, regions),
                note: `${windows.length} of ${all.length} windows have ink and were sent`,
                close: () => ink.delete(),
            };
        } catch (cause) {
            console.error(`warning: could not look at the ink of ${pair.name} (${cause instanceof Error ? cause.message : String(cause)}); sending every window`);
        }
    }
    return { sent: withWindows(loaded, all), tighten: (regions) => regions, note: `${all.length} windows sent, none filtered or tightened (no ink to look at)`, close: () => {} };
}
