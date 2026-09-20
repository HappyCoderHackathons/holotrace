# opencv

The on-device OpenCV stage of Holotrace. Given a photo of a hand-drawn circuit it produces what the recognition service takes:

1. a **sharpened image**, and
2. a **`recognition-v0` request** for that image: one region per likely non-wire component, each with an optional best-guess name.

The regions are hints for the service ([`classifier/`](../classifier/README.md)), not final answers. The image and request go to `POST /v0/recognize`; see [`reference/model-api-example.md`](../reference/model-api-example.md).

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

## Functions

| Function | Input | Returns |
| --- | --- | --- |
| `inkMask(still)` in [`vision/ink.ts`](vision/ink.ts) | RGBA `Mat` | `Mat`, white where there is ink (uses `state.detectScale`) |
| `findComponents(ink)` in [`vision/components.ts`](vision/components.ts) | ink `Mat` | `{ boxes: Rect[], thickness: number }`; `Rect` is `{ x, y, width, height }`, `thickness` is a pen stroke's width in pixels |
| `classify(ink, box, thickness)` in [`vision/classify.ts`](vision/classify.ts) | ink `Mat`, one box, `thickness` | `Match`: `{ label, group, confidence }`, the best symbol found and how well it matches (0 to 1) |
| `nameOf(match)` in [`vision/classify.ts`](vision/classify.ts) | a `Match` | the name to report, or `null` (used by `buildRecognition`) |
| `buildRecognition(width, height, boxes, matches)` in [`recognition.ts`](recognition.ts) | image size, boxes, matches | the `recognition-v0` request object |

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

- **Label names.** The classifier's label set is `cghd-v0` (`resistor`, `capacitor.unpolarized`, `voltage.battery`, `gnd`, `and`, ...; see [`labels.py`](../classifier/src/holotrace_classifier/labels.py)). The local names above are this stage's own. The server only echoes `local_label` back, so nothing breaks, but anything that starts using it needs a mapping.
- **Wire graph and orientation.** The API server's [`OpenCvAnalysis`](../api_server/src/circuit/recognition.ts) also expects a wire graph and an optional rotation per region. This stage produces regions only.

## Dev and test page

[`index.html`](index.html) with [`main.ts`](main.ts) runs the full flow live from a webcam, showing every step, the JSON, and buttons to download the JSON and image. It is for development only.

```console
cd opencv
bun install
bun run dev      # http://localhost:3000
```

Press **R** or click **Reset camera** to start over. The camera is always opened at its native (largest) resolution; never hard-code a size. The live-capture code (`pipeline/`, `vision/circuit.ts`, `vision/capture.ts`) is only used by this page.
