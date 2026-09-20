// Showing the recognition JSON on the page, and saving it and the image it describes as files.

import cv, { Mat } from "../../src/lib/vision/cv";
import { DOWNLOAD_IMAGE_NAME, DOWNLOAD_JSON_NAME, DOWNLOAD_META_NAME } from "../../src/lib/vision/config";
import type { Recognition } from "../../src/lib/vision/recognition";

const panel = () => document.getElementById("recognition-panel") as HTMLDetailsElement;
const jsonButton = () => document.getElementById("save-json") as HTMLButtonElement;
const imageButton = () => document.getElementById("save-image") as HTMLButtonElement;
const metaButton = () => document.getElementById("save-meta") as HTMLButtonElement;

function download(blob: Blob, fileName: string) {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(link.href);
}

// Shows the JSON, and lets the user download it and the sharpened captured circuit it describes.
// `detectScale` is how the capture was scanned (see detectScaleFor); the image alone cannot give it, and a script reading
// the files needs it to look at the ink the way the app does.
export function showRecognition(recognition: Recognition, image: Mat, detectScale: number) {
    const json = JSON.stringify(recognition, null, 2);
    document.getElementById("recognition-json")!.textContent = json;
    panel().hidden = false;

    jsonButton().disabled = false;
    jsonButton().onclick = () => download(new Blob([json], { type: "application/json" }), DOWNLOAD_JSON_NAME);

    metaButton().disabled = false;
    metaButton().onclick = () => download(new Blob([JSON.stringify({ detectScale })], { type: "application/json" }), DOWNLOAD_META_NAME);

    imageButton().disabled = false;
    imageButton().onclick = () => {
        const canvas = document.createElement("canvas");
        cv.imshow(canvas, image);
        canvas.toBlob((blob) => blob && download(blob, DOWNLOAD_IMAGE_NAME), "image/png");
    };
}

// Hides the JSON and image of the previous capture.
export function clearRecognition() {
    panel().hidden = true;
    for (const button of [jsonButton(), imageButton(), metaButton()]) {
        button.disabled = true;
        button.onclick = null;
    }
}
