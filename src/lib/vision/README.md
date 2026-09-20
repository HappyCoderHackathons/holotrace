# vision

The on-device OpenCV stage of Holotrace, part of the app (`src/lib/vision`). Given a photo of a hand-drawn circuit it produces what the recognition service takes:

1. a **sharpened image**, and
2. a **`recognition-v0` request** for that image: one region per likely non-wire component, each with an optional best-guess name.

The regions are hints for the service ([`classifier/`](../../../classifier/README.md)), not final answers. The image and request go to `POST /v0/recognize`; see [`reference/model-api-example.md`](../../../reference/model-api-example.md).

It tries its best and does not have to be right. A person fixes the result up in the review step that follows, so it errs toward including something, and marks every component with where it came from and how sure it is.

## How to call it

The reference callers are [`opencvRecognition.ts`](../opencvRecognition.ts) (before the model) and [`recognitionToCircuit.ts`](../recognitionToCircuit.ts) (after it). Paths below are as in the app; a script imports the same files by relative path, as [`circuit-stuff`](../../../circuit-stuff/README.md) does.

**Before the model: a photo in, an image and a request out.**

```ts
import cv from 'opencv-ts';
import { buildRecognition } from '$lib/vision/recognition';
import { gridWindows } from '$lib/vision/candidates';
import { locateCircuit } from '$lib/vision/circuit';
import { classify } from '$lib/vision/classify';
import { findComponents } from '$lib/vision/components';
import { inkMask } from '$lib/vision/ink';
import { sharpen } from '$lib/vision/sharpen';
import { detectScaleFor, state } from '$lib/vision/state';
import { windowsWithInk } from '$lib/vision/sweep';

// `photo` is the photo as an RGBA cv.Mat, e.g. from cv.imread(image). OpenCV must be loaded first.

// 1. Find the circuit in the photo and cut it out, so a table, a hand or a face around the paper is not scanned.
//    It sets state.detectScale and state.capturedMask, and returns null when no whole circuit is in view.
const cropped = locateCircuit(photo);
const source = cropped ?? photo;
state.detectScale = detectScaleFor(photo.cols);   // (locateCircuit already did; needed for the null case)

// 2. The image to send: an unsharp mask of the crop.
const sharpened = new cv.Mat();
sharpen(source, sharpened);

// 3. Find and name the components.
const ink = inkMask(source);                                        // white where there is ink
const { boxes, thickness } = findComponents(ink);                   // one box per component
const matches = boxes.map((box) => classify(ink, box, thickness));  // a best guess for each

// 4. The sweep, then the request. Send `sharpened` (as PNG) and `request` together.
const sweep = windowsWithInk(ink, gridWindows(sharpened.cols, sharpened.rows));
const request = buildRecognition(sharpened.cols, sharpened.rows, boxes, matches, sweep);
```

Keep the ink (as a PNG, say) and `state.detectScale` for the next step, and free every Mat.

**After the model: the answer in, a circuit out.** Read the same ink back at the same scale, then merge, trace and build:

```ts
state.detectScale = savedScale;
const found = reconcile(tightenRegions(ink, request.regions), answer.regions);   // or [] with no answer
const { diagram, report } = diagramFromInk(found.components, ink, strokeThickness(ink));
```

`diagramFromInk` ([`build.ts`](build.ts)) traces the wires, works out how each part is turned and builds the diagram; the app and `circuit-stuff` both call it. With no model answer the app also keeps the first pass's unsure boxes as generic parts (`withUnsureKept` in [`reconcile.ts`](reconcile.ts)).

Rules for callers:

- **Set `state.detectScale` first, from the whole photo** (`detectScaleFor(photo.cols)`). Ink and stroke sizes are scaled by it. A crop is in the photo's pixels, so it takes the photo's scale, not one worked out from its own width. It is 1 for a photo up to `DETECT_WIDTH` (640) pixels wide.
- **Both steps must read the same ink.** The boxes are found on `inkMask(source)` of the unsharpened crop, with the circuit mask applied. Recomputing ink from the sharpened image, or without the mask, gives a different threshold and different wires. The app saves the ink itself (`scan.ink`) and reads it back.
- **The boxes are in pixels of the image passed to `findComponents`.** `sharpened` has the same size as `source`, so its regions describe it. If you rotate or resize before sending, run the vision code on that image instead, or transform the boxes to match. The service requires `image_width`, `image_height` and every box to describe the image it receives.
- **Free every `cv.Mat`.** `inkMask` and `locateCircuit` return ones that the caller must delete.
- **Run it on the full-resolution image**, not a downscaled copy. Everything is sized in pen-stroke widths, so it needs no other tuning.

### Optional: a sweep, so the first pass does not have to be complete

The first pass is a helper and never finds everything. To make the result not depend on it, add a sweep: square windows laid over the whole image, which the classifier accepts or rejects (it has a `background` label for boxes that hold no symbol). Then merge what the model says about them with the first pass's boxes. In the run on the switch pair this recovered a lamp and a switch the first pass had missed, and restored three switches the model had called `junction`.

```ts
import { gridWindows } from '$lib/vision/candidates';
import { reconcile } from '$lib/vision/reconcile';
import { tightenRegions, windowsWithInk } from '$lib/vision/sweep';

// After step 4 above, keeping `ink` alive until the merge below:
const windows = windowsWithInk(ink, gridWindows(source.cols, source.rows));            // windows that hold ink
const request = buildRecognition(sharpened.cols, sharpened.rows, boxes, matches, windows);  // 5th argument: the sweep

// Send `sharpened` and `request` as before, then merge the answer (`result.regions`) with what was proposed:
const { components } = reconcile(tightenRegions(ink, request.regions), result.regions);
```

`components` are the final answer: each has a box, a classifier label (`cghd-v0`), a confidence, and a `source` saying where it came from: `first-pass` (the model agreed with the first pass's box), `relabelled` (the first pass's box with the label a sweep window got, when the model rejected the box), `kept` (the first pass was sure of a name and the model rejected it without any window disagreeing), or `sweep` (found only by the sweep). First-pass boxes that none of these apply to are returned in `dropped`. The merge leans toward finding things (a person fixes the result up in the review step afterwards, and each component carries its `source` and `confidence` for that). A sweep window counts if the model is at least `MERGE_MIN_CONFIDENCE` (0.6) sure of a component label and at least `MERGE_MIN_SUPPORT` (2) overlapping windows agree with it (1 over a first-pass box, whose own box is a vote): a real symbol lights up under several shifted windows, junk over wiring usually under one. The rules and their numbers are at the top of [`reconcile.ts`](reconcile.ts) and in [`config.ts`](config.ts); `reconcile` also takes an options object, for trying other values out. A request holds at most `MAX_PROPOSALS` (2000) regions; the service takes 2048. The app sends the sweep in [`opencvRecognition.ts`](../opencvRecognition.ts) and merges the answer in [`recognitionToCircuit.ts`](../recognitionToCircuit.ts).

## Functions

| Function | Input | Returns |
| --- | --- | --- |
| `inkMask(still)` in [`ink.ts`](ink.ts) | RGBA `Mat` | `Mat`, white where there is ink (uses `state.detectScale`) |
| `findComponents(ink)` in [`vision/components.ts`](components.ts) | ink `Mat` | `{ boxes: Rect[], thickness: number }`; `Rect` is `{ x, y, width, height }`, `thickness` is a pen stroke's width in pixels |
| `classify(ink, box, thickness)` in [`vision/classify.ts`](classify.ts) | ink `Mat`, one box, `thickness` | `Match`: `{ label, group, confidence }`, the best symbol found and how well it matches (0 to 1) |
| `nameOf(match)` in [`vision/classify.ts`](classify.ts) | a `Match` | the name to report, or `null` (used by `buildRecognition`) |
| `buildRecognition(width, height, boxes, matches, sweep?)` in [`recognition.ts`](recognition.ts) | image size, boxes, matches, optional sweep windows | the `recognition-v0` request object |
| `gridWindows(width, height)` in [`candidates.ts`](candidates.ts) | image size | `Rect[]`, windows of several sizes over the image (no OpenCV) |
| `windowsWithInk(ink, windows)` in [`vision/sweep.ts`](sweep.ts) | ink `Mat`, windows | the windows that hold enough ink to send |
| `tightenRegions(ink, regions)` in [`vision/sweep.ts`](sweep.ts) | ink `Mat`, request regions | the regions with each sweep window shrunk to its ink |
| `reconcile(regions, judgements)` in [`reconcile.ts`](reconcile.ts) | request regions, the model's `regions` | `{ components, dropped }` (no OpenCV) |
| `agrees`, `toClassifierLabel`, `isComponentLabel` in [`labels.ts`](labels.ts) | names and labels | how this stage's names map to the classifier's labels (no OpenCV) |
| `traceWires(ink, boxes, thickness)` in [`wires.ts`](wires.ts) | ink `Mat`, the final components' boxes, stroke width | `WireGraph`: the contacts (where a wire meets a component, in pixels of the ink), the junction points, and the links between them |
| `orientation(ink, box, symbols)` in [`classify.ts`](classify.ts) | ink `Mat`, a box, symbol names (`symbolsFor(label)` in [`labels.ts`](labels.ts)) | `{ rotation, mirrored, score }`: how the symbol is turned in the box, in the order the editor applies them |
| `cv` in [`cv.ts`](cv.ts) | | the one place the dev page and the scripts import OpenCV from, so they share the app's single copy of `opencv-ts` |

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

The names come from the textbook symbols in [`vision/symbols.ts`](symbols.ts) and the hand-drawn examples in [`vision/exemplars.ts`](exemplars.ts). To teach it a component, add an entry to `EXEMPLARS` (group, name and a 48 x 48 bit picture; the format is described at the top of the file) or a drawing to `SYMBOLS`.

## Not yet matching the rest of the system

- **Label names.** The classifier's label set is `cghd-v0` (`resistor`, `capacitor.unpolarized`, `voltage.battery`, `gnd`, `and`, ...; see [`labels.py`](../../../classifier/src/holotrace_classifier/labels.py)). The local names above are this stage's own. The server only echoes `local_label` back, so nothing breaks. The mapping between the two is in [`labels.ts`](labels.ts) for anything that needs it; the API server has not been changed to use it.
- **Wire graph and orientation.** The API server's [`OpenCvAnalysis`](../../../api_server/src/circuit/recognition.ts) also expects a wire graph and an optional rotation per region. The request this stage sends holds regions only (the classifier rejects extra fields). The app traces the wires ([`wires.ts`](wires.ts)) and works out rotations ([`orientation`](classify.ts)) itself, after the model answers, and builds its own diagram from them; nothing sends them to the API server yet.

## Layout

```text
config.ts       every tunable number, each with a comment
state.ts        state shared by the live and still stages
recognition.ts  buildRecognition (the request types are the app's own, in ../recognition.ts)
candidates.ts   sweep windows laid over an image (no OpenCV)
reconcile.ts    merging the first pass with the model's answer (no OpenCV)
labels.ts       this stage's names against the classifier's labels (no OpenCV)
boxes.ts        boxes and how they relate (no OpenCV)
ink.ts          ink mask of an image
components.ts   component boxes
classify.ts     best-guess naming
symbols.ts      textbook symbol drawings and groups
exemplars.ts    real hand-drawn examples
circuit.ts      finding the whole circuit in a photo or frame, and cutting it out
sharpen.ts      the unsharp mask applied before the image is sent
build.ts        components + ink -> diagram (wire tracing, orientation, parts and connections)
sweep.ts        the parts of the sweep that look at the ink
wires.ts        which components each drawn wire touches
cv.ts           the one OpenCV import point for the tools
```

Rules for the files here: they import each other by **relative path only** (no `$lib`), so a Bun script can import them, and the dev page and the scripts import OpenCV through `cv.ts`, so there is one copy.

## Wires

`traceWires` finds which components each drawn wire joins, as **topology**, not a drawing. Every final component's box is wiped out of the ink, so what remains is wire, and that is thinned to a one-pixel skeleton. Where lines meet is judged one place at a time: a dot or a T is a **junction** (a node), four lines with no dot are two wires **crossing** and each goes straight through, and two lines are just a bend. Each place a wire comes up to a component's box is a contact. The result is a `WireGraph`: contacts, junction points, and links between neighbours along a wire (contact to junction, junction to junction, contact to contact), so a bus is a chain of short links, not one hub. It works on a copy scaled so a stroke is a few pixels wide, so a big photo costs no more than a small one, and every number is in `config.ts` (`WIRE_*`). What is built from the result is in [`../diagram`](../diagram/README.md).

Known limits: a crossing drawn with a dot is a junction, and a crossing where the pen bulged into a blob can look like one; junction points sit on the skeleton, not exactly where a person would put them. The editor is where these get fixed.

## The dev page and the scripts

The code here is the source of truth; the tools pull from it. The webcam dev page in [`opencv/`](../../../opencv/README.md) runs the on-device first pass live (including the sweep, as the app sends it), and [`circuit-stuff/`](../../../circuit-stuff/README.md) sends photo + JSON pairs to the model API and shows what comes back. Neither keeps a copy.
