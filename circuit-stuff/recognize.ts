// Sends photo + recognition JSON pairs to the model API and shows what comes back.
//
//   bun circuit-stuff/recognize.ts <folder or file>... [--sweep] [--diagram] [--html] [--json] [--out DIR] [--url URL]
//
// A pair is an image and the recognition-v0 request that describes it: `name.png` + `name.json`, or the
// two files the OpenCV dev page downloads. Run with --help for the options, and see README.md.
//
// The API address and key come from the environment (HOLOTRACE_MODEL_API_URL, HOLOTRACE_ML_API_KEY).
// The key is never printed or stored.

import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { reconcile } from "../src/lib/vision/reconcile";
import { tightenRegions } from "../src/lib/vision/sweep";
import { fail, parseArguments } from "./lib/arguments";
import { makeDiagram, printDiagram, saveDiagram } from "./lib/diagram";
import { loadInk } from "./lib/ink";
import { unmappedNames } from "./lib/labels";
import { loadPair } from "./lib/load-pair";
import { type Outcome, readApiConfig, recognize } from "./lib/model-api";
import { findPairs } from "./lib/pairs";
import { printMerged, printResult, saveOutputs } from "./lib/report";
import { startSweep } from "./lib/sweep";

const options = parseArguments(process.argv.slice(2));

// A saved answer is used in place of the API when asked (--reuse), so a drawing is not sent again.
const api = options.reuse ? null : readApiConfig(options.url);
if (api !== null && "error" in api) fail(api.error);

const unmapped = unmappedNames();
if (unmapped.length > 0) console.error(`warning: no classifier label is mapped for ${unmapped.join(", ")}; those only count as agreeing on an equal name`);

const { pairs, problems } = await findPairs(options.paths);
for (const problem of problems) console.error(`warning: ${problem}`);
if (pairs.length === 0) process.exit(1);

const here = import.meta.dir;
const outDir = resolve(options.out ?? join(here, "results"));
const diagramDir = resolve(options.diagrams ?? join(here, "diagrams"));
let failures = 0;

for (const pair of pairs) {
    const read = await loadPair(pair);
    if ("error" in read) {
        console.error(`\n=== ${pair.name}\nskipped: ${read.error}`);
        failures++;
        continue;
    }
    // The image's ink is needed to judge the sweep and to trace the wires.
    const ink = options.sweep || options.diagram ? await loadInk(read.loaded) : null;
    console.error(`${pair.name}: ${options.sweep ? "looking at the ink..." : "read"}`);
    const sweep = options.sweep && ink !== null ? startSweep(read.loaded, ink) : null;
    if (sweep !== null) console.error(`${pair.name}: ${sweep.note}`);
    const sent = sweep?.sent ?? read.loaded;

    let outcome: Outcome;
    if (api === null) {
        const saved = join(outDir, `${pair.name}.result.json`);
        try {
            const result = JSON.parse(await readFile(saved, "utf8"));
            outcome = result.regions?.length === sent.request.regions.length ? { ok: true, result, seconds: 0 } : { ok: false, error: `${saved} answers ${result.regions?.length} regions but this run sends ${sent.request.regions.length}; run it again with the same options` };
        } catch {
            outcome = { ok: false, error: `no saved answer at ${saved}; run once with --json (without --reuse) first` };
        }
    } else {
        console.error(`${pair.name}: sending ${sent.request.regions.length} regions to ${api.url} ...`);
        outcome = await recognize(api, sent, options.timeoutSeconds);
    }
    if (!outcome.ok) {
        console.error(`\n=== ${pair.name}\nfailed: ${outcome.error}`);
        if (ink !== null && "ink" in ink) ink.close();
        failures++;
        continue;
    }
    printResult(sent, outcome.result, outcome.seconds);
    // Sweep windows are always tightened to their ink before merging, as the app does, with or without --sweep (a request
    // saved from an earlier --sweep run carries its windows).
    const regions = sweep?.tighten(sent.request.regions) ?? (ink !== null && "ink" in ink ? tightenRegions(ink.ink, sent.request.regions) : sent.request.regions);
    const merged = sweep !== null || options.diagram ? reconcile(regions, outcome.result.regions) : null;
    if (merged !== null && sweep !== null) printMerged(outcome.result, merged, sweep.note);

    let diagram = null;
    if (options.diagram && merged !== null) {
        if (ink === null || "error" in ink) console.error(`\n${pair.name}: no diagram (${ink === null ? "no ink" : ink.error})`);
        else {
            diagram = makeDiagram(merged.components, ink);
            printDiagram(pair.name, diagram, await saveDiagram(diagramDir, pair.name, diagram.diagram));
        }
    }
    await saveOutputs(outDir, sent, outcome.result, merged, diagram, options);
    if (ink !== null && "ink" in ink) ink.close();
}

if (failures > 0) console.error(`\n${failures} pair(s) did not get a result`);
process.exit(failures > 0 ? 1 : 0);
