# opencv

The on-device OpenCV stage of Holotrace. Given a photo of a hand-drawn circuit it produces what the recognition service takes:

1. a **sharpened image**, and
2. a **`recognition-v0` request** for that image: one region per likely non-wire component, each with an optional best-guess name.

The regions are hints for the service ([`classifier/`](../classifier/README.md)), not final answers. The image and request go to `POST /v0/recognize`; see [`reference/model-api-example.md`](../reference/model-api-example.md).

It tries its best and does not have to be right. A person fixes the result up in the review step that follows, so it errs toward including something, and marks every component with where it came from and how sure it is.

## How to call it

The reference caller is [`src/lib/opencvRecognition.ts`](../src/lib/opencvRecognition.ts). The sequence is:

```ts
import cv from 'opencv-ts';
import { DETECT_WIDTH, SHARPEN_AMOUNT, SHARPEN_SIGMA } from '../../opencv/config';
import { buildRecognition } from '../../opencv/recognition';
import { state } from '../../opencv/state';
import { classify } from '../../opencv/vision/classify';
import { findComponents } from '../../opencv/vision/components';
import { inkMask } from '../../opencv/vision/ink';

// `source` is the photo as an RGBA cv.Mat, e.g. from cv.imread(image). OpenCV must be loaded first.

// 1. Tell the vision code how large this image is compared with the size it was tuned on.
state.detectScale = Math.max(1, source.cols / DETECT_WIDTH);
// 2. No circuit mask: the whole image is the circuit. (Delete a mask left over from a live capture.)
state.capturedMask?.delete();
state.capturedMask = null;

// 3. The image to send: an unsharp mask of the photo.
const blurred = new cv.Mat();
const sharpened = new cv.Mat();
cv.GaussianBlur(source, blurred, new cv.Size(0, 0), SHARPEN_SIGMA, SHARPEN_SIGMA, cv.BORDER_DEFAULT);
cv.addWeighted(source, SHARPEN_AMOUNT, blurred, 1 - SHARPEN_AMOUNT, 0, sharpened, -1);

// 4. Find and name the components.
const ink = inkMask(source);                                        // white where there is ink
const { boxes, thickness } = findComponents(ink);                   // one box per component
const matches = boxes.map((box) => classify(ink, box, thickness));  // a best guess for each
const request = buildRecognition(sharpened.cols, sharpened.rows, boxes, matches);

// 5. Send `sharpened` (as PNG) and `request` together, then free the Mats.
ink.delete(); blurred.delete(); sharpened.delete(); source.delete();
```

Rules for callers:

- **Set `state.detectScale` first.** Ink and stroke sizes are scaled by it. It is 1 for an image up to `DETECT_WIDTH` (640) pixels wide.
- **The boxes are in pixels of the image passed to `findComponents`.** `sharpened` has the same size as `source`, so its regions describe it. If you crop, rotate or resize before sending, run the vision code on that image instead, or transform the boxes to match. The service requires `image_width`, `image_height` and every box to describe the image it receives.
- **Free every `cv.Mat`.** `inkMask` returns one that the caller must delete.
- **Run it on the full-resolution image**, not a downscaled copy. Everything is sized in pen-stroke widths, so it needs no other tuning.

### Optional: a sweep, so the first pass does not have to be complete

The first pass is a helper and never finds everything. To make the result not depend on it, add a sweep: square windows laid over the whole image, which the classifier accepts or rejects (it has a `background` label for boxes that hold no symbol). Then merge what the model says about them with the first pass's boxes. In the run on the switch pair this recovered a lamp and a switch the first pass had missed, and restored three switches the model had called `junction`.

```ts
import { gridWindows } from '../../opencv/candidates';
import { reconcile } from '../../opencv/reconcile';
import { tightenRegions, windowsWithInk } from '../../opencv/vision/sweep';

// After step 4 above, keeping `ink` alive until the merge below:
const windows = windowsWithInk(ink, gridWindows(source.cols, source.rows));            // windows that hold ink
const request = buildRecognition(sharpened.cols, sharpened.rows, boxes, matches, windows);  // 5th argument: the sweep

// Send `sharpened` and `request` as before, then merge the answer (`result.regions`) with what was proposed:
const { components } = reconcile(tightenRegions(ink, request.regions), result.regions);
```

`components` are the final answer: each has a box, a classifier label (`cghd-v0`), a confidence, and a `source` saying where it came from: `first-pass` (the model agreed with the first pass's box), `relabelled` (the first pass's box with the label a sweep window got, when the model rejected the box), `kept` (the first pass was sure of a name and the model rejected it without any window disagreeing), or `sweep` (found only by the sweep). First-pass boxes that none of these apply to are returned in `dropped`. The merge leans toward finding things (a person fixes the result up in the review step afterwards, and each component carries its `source` and `confidence` for that). A sweep window counts if the model is at least `MERGE_MIN_CONFIDENCE` (0.6) sure of a component label and at least `MERGE_MIN_SUPPORT` (2) overlapping windows agree with it (1 over a first-pass box, whose own box is a vote): a real symbol lights up under several shifted windows, junk over wiring usually under one. The rules and their numbers are at the top of [`reconcile.ts`](reconcile.ts) and in [`config.ts`](config.ts); `reconcile` also takes an options object, for trying other values out. A request holds at most `MAX_PROPOSALS` (2000) regions; the service takes 2048. This is not yet wired into the app's caller in `src/lib/opencvRecognition.ts`.

## Functions

| Function | Input | Returns |
| --- | --- | --- |
| `inkMask(still)` in [`vision/ink.ts`](vision/ink.ts) | RGBA `Mat` | `Mat`, white where there is ink (uses `state.detectScale`) |
| `findComponents(ink)` in [`vision/components.ts`](vision/components.ts) | ink `Mat` | `{ boxes: Rect[], thickness: number }`; `Rect` is `{ x, y, width, height }`, `thickness` is a pen stroke's width in pixels |
| `classify(ink, box, thickness)` in [`vision/classify.ts`](vision/classify.ts) | ink `Mat`, one box, `thickness` | `Match`: `{ label, group, confidence }`, the best symbol found and how well it matches (0 to 1) |
| `nameOf(match)` in [`vision/classify.ts`](vision/classify.ts) | a `Match` | the name to report, or `null` (used by `buildRecognition`) |
| `buildRecognition(width, height, boxes, matches, sweep?)` in [`recognition.ts`](recognition.ts) | image size, boxes, matches, optional sweep windows | the `recognition-v0` request object |
| `gridWindows(width, height)` in [`candidates.ts`](candidates.ts) | image size | `Rect[]`, windows of several sizes over the image (no OpenCV) |
| `windowsWithInk(ink, windows)` in [`vision/sweep.ts`](vision/sweep.ts) | ink `Mat`, windows | the windows that hold enough ink to send |
| `tightenRegions(ink, regions)` in [`vision/sweep.ts`](vision/sweep.ts) | ink `Mat`, request regions | the regions with each sweep window shrunk to its ink |
| `reconcile(regions, judgements)` in [`reconcile.ts`](reconcile.ts) | request regions, the model's `regions` | `{ components, dropped }` (no OpenCV) |
| `agrees`, `toClassifierLabel`, `isComponentLabel` in [`labels.ts`](labels.ts) | names and labels | how this stage's names map to the classifier's labels (no OpenCV) |
| `whenOpenCvReady()` in [`runtime.ts`](runtime.ts) | | OpenCV, once started, for a script running these functions outside a page |

Tuning constants are in [`config.ts`](config.ts), each with a comment.

## What comes out

```json
{
  "schema_version": "recognition-v0",
  "client_preprocess_version": "opencv-v1",
  "image_width": 487,
  "image_height": 386,
  "regions": [
    { "id": "region-0", "box": { "x0": 108, "y0": 233, "x1": 153, "y1": 287 }, "local_label": "lamp", "local_confidence": 0.71 }
  ]
}
```

`x1` and `y1` are exclusive. `local_label` and `local_confidence` come from `nameOf`:

| Match | `local_label` |
| --- | --- |
| confident (`confidence` >= 0.55) | the symbol's own name, e.g. `resistor_ieee`, `and_gate`, `spst_switch`, `lamp` |
| rough (>= 0.4) | its group, a section of the [rapidtables symbol table](https://www.rapidtables.com/electric/electrical_symbols.html): `resistor`, `capacitor`, `inductor`, `power_supply`, `switch_relay`, `ground`, `lamp`, `diode_led`, `transistor`, `logic_gate`, `antenna`, `miscellaneous`, `wire`, `meter` |
| no good guess | `null`, and `local_confidence` is `null` too |

The names come from the textbook symbols in [`vision/symbols.ts`](vision/symbols.ts) and the hand-drawn examples in [`vision/exemplars.ts`](vision/exemplars.ts). To teach it a component, add an entry to `EXEMPLARS` (group, name and a 48 x 48 bit picture; the format is described at the top of the file) or a drawing to `SYMBOLS`.

## Not yet matching the rest of the system

- **Label names.** The classifier's label set is `cghd-v0` (`resistor`, `capacitor.unpolarized`, `voltage.battery`, `gnd`, `and`, ...; see [`labels.py`](../classifier/src/holotrace_classifier/labels.py)). The local names above are this stage's own. The server only echoes `local_label` back, so nothing breaks. The mapping between the two is in [`labels.ts`](labels.ts) for anything that needs it; the API server has not been changed to use it.
- **Wire graph and orientation.** The API server's [`OpenCvAnalysis`](../api_server/src/circuit/recognition.ts) also expects a wire graph and an optional rotation per region. This stage produces regions only.

## Layout

```text
config.ts          every tunable number, each with a comment
state.ts           state shared by the live and still stages
recognition.ts     recognition-v0 types and buildRecognition
candidates.ts      sweep windows laid over an image (no OpenCV)
reconcile.ts       merging the first pass with the model's answer (no OpenCV)
labels.ts          this stage's names against the classifier's labels (no OpenCV)
runtime.ts         starting OpenCV outside a page
geometry/          boxes and how they relate (no OpenCV)
vision/            everything that looks at the image: ink, components, naming, the sweep, the live circuit
pipeline/          the dev page's steps, previews and JSON panel
index.html, main.ts  the dev page
```

## Dev and test page

[`index.html`](index.html) with [`main.ts`](main.ts) runs the full flow live from a webcam, showing every step, the JSON, and buttons to download the JSON and image. It is for development only.

```console
cd opencv
bun install
bun run dev      # http://localhost:3000
```

Check the code with `bun run check` (a strict `tsc` over this folder). Press **R** or click **Reset camera** to start over. The camera is always opened at its native (largest) resolution; never hard-code a size. The live-capture code (`pipeline/`, `vision/circuit.ts`, `vision/capture.ts`) is only used by this page.
