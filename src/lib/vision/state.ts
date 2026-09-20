// State shared between the live camera stage and the still-image stage.

import type { Mat } from "opencv-ts";
import type { Rect } from "./boxes";
import type { Match } from "./classify";

// What the still-image stage works out once, so each preview step can reuse it.
export type StillAnalysis = {
    // One box per component (lamp, battery, switch...), in still pixels.
    components: Rect[];
    // What each component looks like, in the same order (label and confidence of the best symbol).
    matches: Match[];
    // How thick a pen stroke is on the still, in pixels.
    thickness: number;
};

export const state = {
    // How many times larger the full-resolution camera frame is than the detection frame.
    detectScale: 1,
    // The latest full-resolution camera frame.
    fullFrame: null as Mat | null,
    // Set once the circuit has been captured; ends the live camera stage.
    capturedImage: null as Mat | null,
    // White where the captured circuit's own ink may be, same size as the captured still.
    // Ink outside it (a shirt, the desk) is ignored.
    capturedMask: null as Mat | null,
    // Only set while a still is being processed.
    analysis: null as StillAnalysis | null,
};

// Forgets the last capture so a new one can be taken.
export function clearCapture() {
    state.capturedImage?.delete();
    state.capturedImage = null;
    state.capturedMask?.delete();
    state.capturedMask = null;
}
