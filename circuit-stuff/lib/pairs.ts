// Finding the image + JSON pairs to send.

import { readdir, stat } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import { DOWNLOAD_IMAGE_NAME, DOWNLOAD_JSON_NAME } from "../../src/lib/vision/config";

export const IMAGE_TYPES: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg" };

// The stems of the two files the OpenCV dev page downloads.
const DEV_PAGE_IMAGE = basename(DOWNLOAD_IMAGE_NAME, extname(DOWNLOAD_IMAGE_NAME));
const DEV_PAGE_JSON = basename(DOWNLOAD_JSON_NAME, extname(DOWNLOAD_JSON_NAME));

export type Pair = { name: string; imagePath: string; jsonPath: string };

const exists = (path: string) => stat(path).then((s) => s.isFile(), () => false);

// The JSON that goes with an image, if there is one.
async function jsonFor(imagePath: string): Promise<string | null> {
    const stem = basename(imagePath, extname(imagePath));
    const candidates = [join(dirname(imagePath), `${stem}.json`)];
    if (stem === DEV_PAGE_IMAGE) candidates.push(join(dirname(imagePath), DOWNLOAD_JSON_NAME));
    for (const candidate of candidates) if (await exists(candidate)) return candidate;
    return null;
}

// The image that goes with a JSON file, if there is one.
async function imageFor(jsonPath: string): Promise<string | null> {
    const stem = basename(jsonPath, ".json");
    const stems = stem === DEV_PAGE_JSON ? [stem, DEV_PAGE_IMAGE] : [stem];
    for (const candidateStem of stems) {
        for (const extension of Object.keys(IMAGE_TYPES)) {
            const candidate = join(dirname(jsonPath), `${candidateStem}${extension}`);
            if (await exists(candidate)) return candidate;
        }
    }
    return null;
}

// Every pair in the given files and folders (a folder is searched one level deep), and what went wrong.
export async function findPairs(paths: string[]): Promise<{ pairs: Pair[]; problems: string[] }> {
    const files: string[] = [];
    const problems: string[] = [];
    for (const path of paths) {
        const full = resolve(path);
        const info = await stat(full).catch(() => null);
        if (info === null) problems.push(`${path}: not found`);
        else if (info.isDirectory()) files.push(...(await readdir(full)).sort().map((entry) => join(full, entry)));
        else files.push(full);
    }
    const named = paths.map((path) => resolve(path));
    const pairs = new Map<string, Pair>();
    for (const file of files) {
        const extension = extname(file).toLowerCase();
        const isImage = extension in IMAGE_TYPES;
        if (!isImage && extension !== ".json") continue;
        const imagePath = isImage ? file : await imageFor(file);
        const jsonPath = isImage ? await jsonFor(file) : file;
        if (imagePath === null || jsonPath === null) {
            // A stray file in a folder is only worth mentioning if it was named directly.
            if (named.includes(file)) problems.push(`${file}: no ${isImage ? "JSON" : "image"} to go with it`);
            continue;
        }
        pairs.set(imagePath, { name: basename(imagePath, extname(imagePath)), imagePath, jsonPath });
    }
    if (pairs.size === 0) problems.push("no image + JSON pairs found");
    return { pairs: [...pairs.values()], problems };
}
