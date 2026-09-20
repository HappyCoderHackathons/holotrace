// The JSON handed to the next stage (a language model) after a capture, together with the sharpened
// captured circuit: hints on where the non-wire components are, so that stage can find them better
// and faster, with room for a local guess at what each one is. Field names and order follow the
// "recognition-v0" contract.

import { CLIENT_PREPROCESS_VERSION, RECOGNITION_SCHEMA_VERSION, type RecognitionRequest, type RegionProposal } from "../recognition";
import { type Rect, toCorners } from "./boxes";
import { evenlyThinned, SWEEP_ID_PREFIX } from "./candidates";
import { nameOf, type Match } from "./classify";
import { MAX_PROPOSALS } from "./config";

// The request and its regions are the app's own contract types (../recognition.ts): boxes are corners in pixels
// of the captured circuit image (x1 and y1 exclusive), and local_label is the best matching common symbol (or,
// for a rough match, its coarser name; see nameOf), null when there is no good guess.
export type Recognition = RecognitionRequest;

// Builds the JSON for a captured circuit image of the given size, the component boxes found in it and
// what each one looks like (in the same order). `sweep` adds windows the first pass did not find (see
// candidates.ts): they carry no guess, and the model's answer to them is merged in by reconcile.ts.
export function buildRecognition(imageWidth: number, imageHeight: number, components: Rect[], matches: Match[], sweep: Rect[] = []): Recognition {
    const found: RegionProposal[] = components.map((box, n) => ({
        id: `region-${n}`,
        box: toCorners(box),
        local_label: nameOf(matches[n]),
        local_confidence: nameOf(matches[n]) === null ? null : Math.round(matches[n].confidence * 100) / 100,
    }));
    const extra: RegionProposal[] = evenlyThinned(sweep, MAX_PROPOSALS - found.length).map((box, n) => ({
        id: `${SWEEP_ID_PREFIX}${n}`,
        box: toCorners(box),
        local_label: null,
        local_confidence: null,
    }));
    return {
        schema_version: RECOGNITION_SCHEMA_VERSION,
        client_preprocess_version: CLIENT_PREPROCESS_VERSION,
        image_width: imageWidth,
        image_height: imageHeight,
        regions: [...found, ...extra],
    };
}
