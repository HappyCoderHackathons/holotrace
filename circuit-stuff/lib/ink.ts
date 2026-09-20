// The ink of a pair's image, looked at the way the app looks at a photo: the same ink mask and stroke width.

import { extname } from "node:path";
import { strokeThickness } from "../../src/lib/vision/components";
import { inkMask } from "../../src/lib/vision/ink";
import { detectScaleFor, state } from "../../src/lib/vision/state";
import type { Mat } from "../../src/lib/vision/cv";
import type { LoadedPair } from "./load-pair";
import { whenOpenCvReady } from "./opencv";
import { decodePng } from "./png";

export type PairInk = {
    // White where there is ink, the size of the image. Freed by close().
    ink: Mat;
    // How wide a pen stroke is, in pixels.
    thickness: number;
    close: () => void;
};

// The ink of a pair's image, or why it cannot be had (only PNG images can be read here).
export async function loadInk(loaded: LoadedPair): Promise<PairInk | { error: string }> {
    if (extname(loaded.pair.imagePath).toLowerCase() !== ".png") return { error: "the image is not a PNG, and this script can only look at the ink of PNG images" };
    try {
        const { width, height, rgba } = decodePng(loaded.image);
        const { cv } = await whenOpenCvReady();
        const source = new cv.Mat(height, width, cv.CV_8UC4);
        source.data.set(rgba);
        // The scale the capture was scanned at, from the dev page's meta file. Without it the image's own width is used, which
        // is only right for an uncropped photo (a crop is in the photo's pixels, so its width reads too small).
        if (loaded.detectScale === null) console.error(`warning: ${loaded.pair.name} has no .meta.json (save it with the dev page's Download scale button); guessing the scale from the image width`);
        state.detectScale = loaded.detectScale ?? detectScaleFor(width);
        state.capturedMask = null;
        const ink = inkMask(source);
        source.delete();
        return { ink, thickness: strokeThickness(ink), close: () => ink.delete() };
    } catch (cause) {
        return { error: cause instanceof Error ? cause.message : String(cause) };
    }
}
