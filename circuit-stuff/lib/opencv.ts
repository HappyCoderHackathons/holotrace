// Starting OpenCV (opencv-ts) outside a page, for a script that uses this folder's vision code. The dev page
// and the app start it their own ways.

import cv from "../../src/lib/vision/cv";

// OpenCV once its runtime has started (it starts in the background when the package is first imported). This
// polls instead of waiting for a callback, which does not fire again if OpenCV started before it was asked.
// The result is wrapped, because OpenCV's own object has a `then` method, so a promise resolved with it
// never settles: use `const { cv } = await whenOpenCvReady()`.
export function whenOpenCvReady(timeoutSeconds = 10): Promise<{ cv: typeof cv }> {
    const started = Date.now();
    return new Promise((resolve, reject) => {
        const check = () => {
            try {
                new cv.Mat().delete();
                resolve({ cv });
            } catch {
                if (Date.now() - started > timeoutSeconds * 1000) reject(new Error(`OpenCV did not start within ${timeoutSeconds} s`));
                else setTimeout(check, 50);
            }
        };
        check();
    });
}
