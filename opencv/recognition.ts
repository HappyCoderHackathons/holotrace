// The JSON handed to the next stage (a language model) after a capture, together with the sharpened
// captured circuit: hints on where the non-wire components are, so that stage can find them better
// and faster, with room for a local guess at what each one is. Field names and order follow the
// "recognition-v0" contract.

import type { Rect } from "./geometry/boxes";
import { nameOf, type Match } from "./vision/classify";

export const SCHEMA_VERSION = "recognition-v0";
export const CLIENT_PREPROCESS_VERSION = "opencv-v1";

export type Region = {
    id: string;
    // Corners in pixels of the captured circuit image; x1 and y1 are exclusive.
    box: { x0: number; y0: number; x1: number; y1: number };
    // What this client thinks the region is, if it has an opinion: the best matching common symbol
    // (or, for a rough match, its coarser name; see nameOf). Both are null when there is no good guess.
    local_label: string | null;
    local_confidence: number | null;
};

export type Recognition = {
    schema_version: typeof SCHEMA_VERSION;
    client_preprocess_version: string;
    image_width: number;
    image_height: number;
    regions: Region[];
};

// Builds the JSON for a captured circuit image of the given size, the component boxes found in it and
// what each one looks like (in the same order).
export function buildRecognition(imageWidth: number, imageHeight: number, components: Rect[], matches: Match[]): Recognition {
    return {
        schema_version: SCHEMA_VERSION,
        client_preprocess_version: CLIENT_PREPROCESS_VERSION,
        image_width: imageWidth,
        image_height: imageHeight,
        regions: components.map((box, n) => ({
            id: `region-${n}`,
            box: { x0: box.x, y0: box.y, x1: box.x + box.width, y1: box.y + box.height },
            local_label: nameOf(matches[n]),
            local_confidence: nameOf(matches[n]) === null ? null : Math.round(matches[n].confidence * 100) / 100,
        })),
    };
}
