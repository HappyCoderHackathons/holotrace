# opencv

A webcam dev and test page for the app's on-device OpenCV first pass. It runs the whole flow live and shows every step, so the vision code can be tuned by eye. It is for development only; the code it runs lives in the app, in [`src/lib/vision`](../src/lib/vision/README.md), and this folder pulls it from there.

```text
camera  ->  find the whole circuit  ->  hold still, take a screenshot
        ->  sharpen  ->  find and name the components  ->  recognition.json + captured-circuit.png
```

## Running it

```console
bun install          # once, at the repository root: the page resolves opencv-ts from there
cd opencv
bun run dev          # http://localhost:3000
```

Bun bundles the TypeScript on the fly, so no `.js` files are generated. Allow camera access. The page shows a preview of each step, the recognition JSON, and buttons to download the JSON and the image. Press **R** or click **Reset camera** to start over. Do not name a module `output.ts`: it breaks Bun's dev server bundling.

The camera is always opened at its **native (largest supported) resolution**: `main.ts` reads `getCapabilities()` and asks for the maximum. Never hard-code a size. Circuit detection runs on a copy scaled to `DETECT_WIDTH` for speed; only the captured still uses full resolution.

## What is here

```text
index.html, main.ts   the page and the camera loop
pipeline/             the steps, previews and JSON panel
vision/capture.ts     the hold-still charge meter and cropping the screenshot (the live camera only)
```

Everything else the page uses (ink, components, naming, `config.ts`, `state.ts`) is imported from `../src/lib/vision/`, and OpenCV through `../src/lib/vision/cv.ts`, so the page, the app and the scripts share one copy. The live-camera files above are only used by this page. The two files the page downloads keep the names in `config.ts` (`DOWNLOAD_JSON_NAME`, `DOWNLOAD_IMAGE_NAME`), which [`circuit-stuff`](../circuit-stuff/README.md) uses to pair them up.

Check the code with `bun run check` (a strict `tsc` over this folder and what it imports).
