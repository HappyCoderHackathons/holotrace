# circuit-stuff

Scripts for trying out the circuit-recognition service by hand.

## recognize.ts

Sends photo + JSON pairs to the model API and shows what comes back, region by region, next to the OpenCV stage's own guess.

```console
cd circuit-stuff        # so that its .env is read (or export HOLOTRACE_MODEL_API_URL and HOLOTRACE_ML_API_KEY)

bun recognize.ts pairs                    # a folder of pairs
bun recognize.ts captured-circuit.png     # one pair (its JSON is found beside it)
bun recognize.ts pairs --html --json      # also write reports and raw responses
bun recognize.ts pairs --sweep --html     # also sweep the whole image, and merge (see below)
bun recognize.ts pairs --diagram --html   # also work out the wiring and write diagrams/<name>.diagram.json
bun recognize.ts pairs --sweep --diagram --reuse --html   # the same from the saved answers, without calling the API
```

A **pair** is an image and the `recognition-v0` request that describes it, side by side with the same name: `gates.png` + `gates.json`. The two files the [OpenCV dev page](../opencv/README.md) downloads, `captured-circuit.png` and `recognition.json`, count as a pair too. A folder is searched one level deep. Run `bun recognize.ts --help` for the options.

The address and key are read from the environment only (a `.env` in the folder you run from works with Bun; copy [`.env.example`](.env.example) to start), and the key is never printed or written anywhere. The script refuses to send it over plain `http` to anything but this machine or a Tailscale address. The address is `--url`, else `HOLOTRACE_MODEL_API_URL`, else built from the classifier service's own `HOLOTRACE_ML_HOST` and `HOLOTRACE_ML_PORT` (a public name is used over `https`). The exit code is 1 if any pair did not get a result.

Each pair is checked before it is sent (the JSON's size must match the image; the service answers 422 otherwise). The output lists each region with:

- the OpenCV stage's **local** guess, and the model's label and confidence, marked `=` when the model agrees and `!` when it differs (the local names are mapped to `cghd-v0` labels for this; the script warns if one has no mapping);
- what the API server's normalizer would do with the model's label: `not a component` (text, junction, crossover, background), `no pin template yet`, or `N pins`;
- the next best alternatives.

`--html` writes a page per pair with the boxes drawn on the image, and `--json` the raw response, both to `circuit-stuff/results/` (or `--out DIR`), which git ignores because it holds your drawings.

### `--sweep`: testing recall without depending on the first pass

The first pass misses components and the classifier only judges the boxes it is given. With `--sweep` the script also sends a grid of square windows laid over the whole image (about a thousand a pair, a few seconds), then merges the model's answers with the first pass's boxes using [`src/lib/vision/reconcile.ts`](../src/lib/vision/reconcile.ts). It uses the same ink code as the app, so windows with no ink are not sent and each surviving window is tightened to its ink before merging (PNG images only; for any other image every window is sent and left as it is). The output adds a merged list, marking where each component came from: `first-pass` (the model agreed), `relabelled` (first pass's box, the sweep's label), `kept` (the first pass was sure and the model rejected it), or `sweep` (found only by the sweep). `--html` colours the boxes by that source, and `--json` also writes `<name>.merged.json`. The merge leans toward finding things, since a person fixes the result up afterwards; the rules and numbers are in [the vision README](../src/lib/vision/README.md).

### `--diagram`: the final components and how they are wired

`--diagram` builds a **diagram** per pair: the final components and their connections, in the shape of Wokwi's `diagram.json` (see [`src/lib/diagram`](../src/lib/diagram/README.md)). It merges the model's answer with the first pass (with or without `--sweep`), traces the wires in the image's ink ([`src/lib/vision/wires.ts`](../src/lib/vision/wires.ts)), works out how each part is turned, and writes `diagrams/<name>.diagram.json` (or `--diagrams DIR`). It is separate from `results/`: results are diagnostics, a diagram is the product. `diagrams/` is git-ignored because it is built from your drawings. The console lists what it found, and any wire that stops at one part, any part nothing is wired to, and any wire contact with no free pin; `--html` also draws the traced wiring over the image (dashed lines for connections, white dots for pins, yellow dots for junction nodes) so it can be checked by eye. PNG images only, since the ink is needed. A wire that crosses another without a dot is read as joined to it, so a dense bus can merge into one net (the editor is where that is fixed).

### `--reuse`: no new call to the API

`--reuse` reads the saved `<name>.result.json` from the output folder instead of calling the API, so a drawing is not sent again just to change how the answer is merged or wired. It needs an earlier run with `--json`, on the same image and with the same `--sweep` option (it checks the number of regions matches).

## How it is put together

`recognize.ts` is only the sequence of calls; the work is in small modules, and it calls existing code in the repo instead of repeating it.

| File | Does |
| --- | --- |
| [`lib/arguments.ts`](lib/arguments.ts) | the command line |
| [`lib/pairs.ts`](lib/pairs.ts) | finds image + JSON pairs, using the dev page's file names from [`src/lib/vision/config.ts`](../src/lib/vision/config.ts) |
| [`lib/load-pair.ts`](lib/load-pair.ts) | reads a pair and checks it, using the schema version and request type from [`src/lib/recognition.ts`](../src/lib/recognition.ts) |
| [`lib/model-api.ts`](lib/model-api.ts) | the `POST /v0/recognize` call (the app makes the same call through `src-tauri/src/lib.rs`, which a script cannot use) |
| [`lib/labels.ts`](lib/labels.ts) | the OpenCV stage's name mapping from [`src/lib/vision/labels.ts`](../src/lib/vision/labels.ts), and what the normalizer ([`isComponentLabel`, `getPinTemplate`](../api_server/src/circuit/pin-templates.ts)) does with a label |
| [`lib/ink.ts`](lib/ink.ts) | the ink and stroke width of a pair's PNG, looked at the way the app looks at a photo |
| [`lib/diagram.ts`](lib/diagram.ts) | traces the wires, works out orientations, builds and writes the diagram |
| [`lib/sweep.ts`](lib/sweep.ts) | the sweep: adds windows ([`src/lib/vision/candidates.ts`](../src/lib/vision/candidates.ts)), looks at the ink and tightens them ([`src/lib/vision/sweep.ts`](../src/lib/vision/sweep.ts)) |
| [`lib/opencv.ts`](lib/opencv.ts) | starts OpenCV under Bun, through the app's single copy ([`src/lib/vision/cv.ts`](../src/lib/vision/cv.ts)) |
| [`lib/png.ts`](lib/png.ts) | a small PNG decoder (Bun has none) so the sweep can look at the image's ink |
| [`lib/report.ts`](lib/report.ts) | the console output and the HTML report |

The script needs nothing installed to run. `package.json` and `tsconfig.json` are only there so an editor gets Bun's types (`bun install` in this folder) and `bun run check` can type-check it.
