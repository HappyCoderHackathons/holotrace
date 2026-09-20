// Sends photo + recognition JSON pairs to the model API and shows what comes back.
//
//   bun circuit-stuff/recognize.ts <folder or file>... [--sweep] [--html] [--json] [--out DIR] [--url URL]
//
// A pair is an image and the recognition-v0 request that describes it: `name.png` + `name.json`, or the
// two files the OpenCV dev page downloads. Run with --help for the options, and see README.md.
//
// The API address and key come from the environment (HOLOTRACE_MODEL_API_URL, HOLOTRACE_ML_API_KEY).
// The key is never printed or stored.

import { join, resolve } from "node:path";
import { reconcile } from "../opencv/reconcile";
import { fail, parseArguments } from "./lib/arguments";
import { unmappedNames } from "./lib/labels";
import { loadPair } from "./lib/load-pair";
import { readApiConfig, recognize } from "./lib/model-api";
import { findPairs } from "./lib/pairs";
import { printMerged, printResult, saveOutputs } from "./lib/report";
import { startSweep } from "./lib/sweep";

const options = parseArguments(process.argv.slice(2));

const api = readApiConfig(options.url);
if ("error" in api) fail(api.error);

const unmapped = unmappedNames();
if (unmapped.length > 0) console.error(`warning: no classifier label is mapped for ${unmapped.join(", ")}; those only count as agreeing on an equal name`);

const { pairs, problems } = await findPairs(options.paths);
for (const problem of problems) console.error(`warning: ${problem}`);
if (pairs.length === 0) process.exit(1);

const outDir = resolve(options.out ?? join(import.meta.dir, "results"));
let failures = 0;

for (const pair of pairs) {
    const read = await loadPair(pair);
    if ("error" in read) {
        console.error(`\n=== ${pair.name}\nskipped: ${read.error}`);
        failures++;
        continue;
    }
    console.error(`${pair.name}: ${options.sweep ? "looking at the ink..." : "read"}`);
    const sweep = options.sweep ? await startSweep(read.loaded) : null;
    if (sweep !== null) console.error(`${pair.name}: ${sweep.note}`);
    const sent = sweep?.sent ?? read.loaded;
    console.error(`${pair.name}: sending ${sent.request.regions.length} regions to ${api.url} ...`);
    const outcome = await recognize(api, sent, options.timeoutSeconds);
    if (!outcome.ok) {
        console.error(`\n=== ${pair.name}\nfailed: ${outcome.error}`);
        sweep?.close();
        failures++;
        continue;
    }
    printResult(sent, outcome.result, outcome.seconds);
    const merged = sweep === null ? null : reconcile(sweep.tighten(sent.request.regions), outcome.result.regions);
    if (merged !== null) printMerged(outcome.result, merged, sweep?.note ?? "");
    await saveOutputs(outDir, sent, outcome.result, merged, options);
    sweep?.close();
}

if (failures > 0) console.error(`\n${failures} pair(s) did not get a result`);
process.exit(failures > 0 ? 1 : 0);
