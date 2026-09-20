// The unsharp mask applied to the circuit before it is sent on. One copy, for the app and the dev page.

import cv, { type Mat } from "./cv";
import { SHARPEN_AMOUNT, SHARPEN_SIGMA } from "./config";

export function sharpen(source: Mat, output: Mat) {
    const blurred = new cv.Mat();
    cv.GaussianBlur(source, blurred, new cv.Size(0, 0), SHARPEN_SIGMA, SHARPEN_SIGMA, cv.BORDER_DEFAULT);
    cv.addWeighted(source, SHARPEN_AMOUNT, blurred, 1 - SHARPEN_AMOUNT, 0, output, -1);
    blurred.delete();
}
