// Reading a pair from disk and checking it before it is sent.

import { readFile } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import { RECOGNITION_SCHEMA_VERSION, type RecognitionRequest } from "../../src/lib/recognition";
import type { Pair } from "./pairs";

// The service refuses bigger uploads (max_upload_mb in classifier/.../service.py; the app enforces the same
// limit in src-tauri/src/lib.rs).
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export type LoadedPair = {
    pair: Pair;
    image: Uint8Array;
    requestText: string;
    request: RecognitionRequest;
    // How the capture was scanned (see detectScaleFor in src/lib/vision/state.ts), from the `<image>.meta.json` the dev page
    // saves beside the image, or null when there is none (the scale is then guessed from the image's width).
    detectScale: number | null;
};

// The scale in the pair's meta file, if it has one.
async function readDetectScale(pair: Pair): Promise<number | null> {
    const file = join(dirname(pair.imagePath), `${basename(pair.imagePath, extname(pair.imagePath))}.meta.json`);
    try {
        const scale = (JSON.parse(await readFile(file, "utf8")) as { detectScale?: unknown }).detectScale;
        return typeof scale === "number" && Number.isFinite(scale) && scale >= 1 ? scale : null;
    } catch {
        return null;
    }
}

// The width and height of a PNG or JPEG, read from its header, or null if it is neither.
export function imageSize(bytes: Uint8Array): { width: number; height: number } | null {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (bytes.length > 24 && view.getUint32(0) === 0x89504e47) return { width: view.getUint32(16), height: view.getUint32(20) };
    if (bytes.length > 4 && view.getUint16(0) === 0xffd8) {
        let at = 2;
        while (at + 9 < bytes.length) {
            if (bytes[at] !== 0xff) return null;
            const marker = bytes[at + 1];
            const isFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
            if (isFrame) return { height: view.getUint16(at + 5), width: view.getUint16(at + 7) };
            at += 2 + view.getUint16(at + 2);
        }
    }
    return null;
}

// The request in `text`, if it is a recognition request for this image; otherwise what is wrong with it.
function parseRequest(text: string, image: Uint8Array): { request: RecognitionRequest } | { error: string } {
    let value: unknown;
    try {
        value = JSON.parse(text);
    } catch {
        return { error: "the JSON file could not be parsed" };
    }
    const request = value as Partial<RecognitionRequest> | null;
    if (typeof request !== "object" || request === null) return { error: "the JSON is not an object" };
    if (request.schema_version !== RECOGNITION_SCHEMA_VERSION) return { error: `schema_version is ${JSON.stringify(request.schema_version)}, not "${RECOGNITION_SCHEMA_VERSION}"` };
    if (!Number.isInteger(request.image_width) || !Number.isInteger(request.image_height)) return { error: "image_width and image_height must be whole numbers" };
    if (!Array.isArray(request.regions)) return { error: "regions must be a list" };
    const size = imageSize(image);
    if (size !== null && (size.width !== request.image_width || size.height !== request.image_height)) {
        return { error: `the JSON describes a ${request.image_width}x${request.image_height} image but the image is ${size.width}x${size.height}` };
    }
    return { request: request as RecognitionRequest };
}

// Reads both files of a pair and checks them, or says why the pair cannot be sent.
export async function loadPair(pair: Pair): Promise<{ loaded: LoadedPair } | { error: string }> {
    const image = new Uint8Array(await readFile(pair.imagePath));
    const requestText = await readFile(pair.jsonPath, "utf8");
    if (image.length > MAX_UPLOAD_BYTES) return { error: `the image is ${(image.length / 1048576).toFixed(1)} MB and the service takes at most 20 MB` };
    const parsed = parseRequest(requestText, image);
    if ("error" in parsed) return { error: parsed.error };
    return { loaded: { pair, image, requestText, request: parsed.request, detectScale: await readDetectScale(pair) } };
}
