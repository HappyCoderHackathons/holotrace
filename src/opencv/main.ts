// Entry point: opens the camera, runs the live stage until a circuit is captured, then hands the
// captured still to the still stage. See pipeline/ for the two stages and config.ts for settings.

import cv from "opencv-ts";
import { DETECT_WIDTH, RESET_KEY } from "./config";
import { liveSteps } from "./pipeline/live";
import { clearRecognition } from "./pipeline/recognition-panel";
import { makePreview } from "./pipeline/preview";
import { processStill } from "./pipeline/still";
import { clearCapture, state } from "./state";
import { resetHold } from "./vision/capture";

// Waits until the video element is delivering frames of the given width. After the camera is
// switched to another mode the browser needs a moment before frames arrive at the new size.
async function waitForWidth(video: HTMLVideoElement, width: number) {
    for (let waited = 0; video.videoWidth !== width && waited < 3000; waited += 50) {
        await new Promise((resolve) => setTimeout(resolve, 50));
    }
}

// Opens the camera at its native resolution, and asks it for continuous autofocus.
export async function openCamera(video: HTMLVideoElement) {
    // Open with no size in mind first, to learn what the camera can do.
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    const [track] = stream.getVideoTracks();

    // Native resolution is the largest size the camera supports; the browser picks the closest
    // mode it has to what is asked for.
    const { width, height } = track.getCapabilities();
    if (width?.max && height?.max) {
        await track
            .applyConstraints({ width: { ideal: width.max }, height: { ideal: height.max } })
            .catch(() => {});
    }
    // Many cameras ignore the autofocus request, so failure is fine.
    track.applyConstraints({ advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet] }).catch(() => {});

    video.srcObject = stream;
    await video.play();
    const size = track.getSettings();
    if (size.width) await waitForWidth(video, size.width);
    video.width = video.videoWidth;
    video.height = video.videoHeight;
}

export function closeCamera(video: HTMLVideoElement) {
    (video.srcObject as MediaStream).getTracks().forEach((track) => track.stop());
}

async function start() {
    const video = document.getElementById("camera") as HTMLVideoElement;
    const resetButton = document.getElementById("reset") as HTMLButtonElement;

    // The live steps' previews are made once and redrawn every frame. Hidden steps have none.
    const frame = new cv.Mat();
    const outputs = liveSteps.map(() => new cv.Mat());
    const canvasIds = liveSteps.map((step) => (step.hidden ? null : makePreview(step.name)));
    makePreview("Captured circuit");

    let running = false;

    // Runs the live stage until a circuit is captured, then the still stage.
    const startLive = async () => {
        running = true;
        resetButton.disabled = true;
        await openCamera(video);

        const { videoWidth, videoHeight } = video;
        state.fullFrame?.delete();
        state.fullFrame = new cv.Mat(videoHeight, videoWidth, cv.CV_8UC4);
        state.detectScale = videoWidth / DETECT_WIDTH;
        const detectSize = new cv.Size(DETECT_WIDTH, Math.round(videoHeight / state.detectScale));
        const capture = new cv.VideoCapture(video);

        const tick = () => {
            capture.read(state.fullFrame!);
            cv.resize(state.fullFrame!, frame, detectSize, 0, 0, cv.INTER_AREA);
            liveSteps.forEach((step, n) => {
                step.apply(n === 0 ? frame : outputs[n - 1], outputs[n], frame);
                const canvasId = canvasIds[n];
                if (canvasId !== null) cv.imshow(canvasId, outputs[n]);
            });
            if (state.capturedImage !== null) {
                try {
                    processStill(state.capturedImage);
                } catch (err) {
                    console.error("still processing failed:", err);
                }
                closeCamera(video);
                running = false;
                resetButton.disabled = false;
                return; // live stage over: no more frames, no more circuit detection
            }
            requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    };

    // Goes back to the live camera after a capture (button, or RESET_KEY).
    const reset = () => {
        if (running) return;
        clearCapture();
        clearRecognition();
        resetHold();
        startLive().catch((err) => console.error("camera restart failed:", err));
    };
    resetButton.addEventListener("click", reset);
    window.addEventListener("keydown", (event) => {
        if (event.key.toLowerCase() === RESET_KEY) reset();
    });

    await startLive();
}

cv.onRuntimeInitialized = () => {
    start().catch((err) => console.error("camera/OpenCV start failed:", err));
};
