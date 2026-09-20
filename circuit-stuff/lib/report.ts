// Showing a recognition result: on the console, and as files.

import { mkdir, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { isSweepId } from "../../src/lib/vision/candidates";
import type { Component, Source } from "../../src/lib/vision/reconcile";
import type { BoundingBox, RecognitionResult } from "../../src/lib/recognition";
import { agrees, downstreamUse } from "./labels";
import type { DiagramResult } from "./diagram";
import type { LoadedPair } from "./load-pair";
import { IMAGE_TYPES } from "./pairs";

type Reconciled = { components: Component[]; dropped: unknown[] };
type Prediction = RecognitionResult["regions"][number];

const percent = (value: number) => value.toFixed(2);
const boxText = (box: BoundingBox) => `[${Math.round(box.x0)},${Math.round(box.y0)} -> ${Math.round(box.x1)},${Math.round(box.y1)}]`;
const pad = (text: string, width: number) => text.padEnd(width);
const alternativesText = (prediction: Prediction) => prediction.alternatives.slice(0, 3).map((a) => `${a.label} ${percent(a.confidence)}`).join(", ");

// The OpenCV stage's guess for a region, from the model's echo of it or from the request.
function localGuess({ request }: LoadedPair, prediction: Prediction) {
    const region = request.regions.find((r) => r.id === prediction.region_id);
    return { region, label: prediction.local_label ?? region?.local_label ?? null };
}

// The first pass's own regions, not the sweep windows added to them.
const firstPassOnly = (result: RecognitionResult) => result.regions.filter((prediction) => !isSweepId(prediction.region_id));

export function printResult(loaded: LoadedPair, result: RecognitionResult, seconds: number) {
    const { pair, request } = loaded;
    const predictions = firstPassOnly(result);
    const windows = result.regions.length - predictions.length;
    console.log(`\n=== ${pair.name}  ${request.image_width}x${request.image_height}, ${predictions.length} regions${windows > 0 ? ` + ${windows} sweep windows` : ""}, ${seconds.toFixed(1)} s`);
    console.log(`label set ${result.label_set_version} | classifier ${result.classifier_version ?? "none"} | detector ${result.detector_version ?? "none"}`);
    let agreeing = 0;
    let differing = 0;
    let noGuess = 0;
    let usable = 0;
    for (const prediction of predictions) {
        const { region, label: local } = localGuess(loaded, prediction);
        const verdict = agrees(local, prediction.label);
        const use = downstreamUse(prediction.label);
        if (verdict === true) agreeing++;
        if (verdict === false) differing++;
        if (local === null) noGuess++;
        if (use.endsWith("pin") || use.endsWith("pins")) usable++;
        const mark = verdict === null ? " " : verdict ? "=" : "!";
        const localText = local === null ? "-" : `${local}${region?.local_confidence == null ? "" : ` ${percent(region.local_confidence)}`}`;
        const others = alternativesText(prediction);
        console.log(
            `${mark} ${pad(prediction.region_id, 10)} ${pad(region ? boxText(region.box) : "", 24)} local: ${pad(localText, 26)} model: ${pad(`${prediction.label} ${percent(prediction.confidence)}`, 28)} used as: ${pad(use, 22)}${others ? `also: ${others}` : ""}`,
        );
    }
    if (result.detections.length > 0) {
        console.log(`detections on the whole page (${result.detections.length}):`);
        for (const detection of result.detections) console.log(`    ${pad(boxText(detection.box), 24)} ${detection.label} ${percent(detection.confidence)}`);
    }
    console.log(`summary: ${predictions.length} regions; the model agrees with the local guess on ${agreeing}, differs on ${differing}, and ${noGuess} had no local guess`);
    console.log(`         ${usable} would become components with pins in the normalizer`);
    console.log("  (= agrees, ! differs; local names are mapped to the classifier's labels in src/lib/vision/labels.ts)");
}

// What each source of a merged component means, for the console and the report.
const SOURCE_TEXT: Record<Source, string> = {
    "first-pass": "first pass, model agreed",
    relabelled: "first-pass box, label from the sweep",
    kept: "first pass kept against the model",
    sweep: "found only by the sweep",
};
const SOURCE_COLOR: Record<Source, string> = { "first-pass": "#2f9e44", relabelled: "#f08c00", kept: "#7048e8", sweep: "#1971c2" };

export function printMerged(result: RecognitionResult, merged: Reconciled, note: string) {
    const windows = result.regions.filter((prediction) => isSweepId(prediction.region_id));
    const count = (source: Source) => merged.components.filter((component) => component.source === source).length;
    console.log(`\nmerged with the sweep (${note}; ${windows.filter((w) => w.label !== "background").length} not called background):`);
    for (const component of merged.components) {
        const first = component.localLabel === null ? "" : `first pass ${component.localLabel}, `;
        console.log(`  ${pad(component.source, 11)} ${pad(boxText(component.box), 24)} ${pad(`${component.label} ${percent(component.confidence)}`, 26)} ${first}${component.modelLabel === null ? "" : `model said ${component.modelLabel}`}`);
    }
    console.log(`  ${merged.components.length} components: ${count("first-pass")} first pass, ${count("relabelled")} relabelled, ${count("kept")} kept, ${count("sweep")} found only by the sweep; ${merged.dropped.length} first-pass boxes dropped`);
}

const escapeHtml = (text: string) => text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);

// A page with the image and a box on every region (green: the model agrees with the local guess, red: it
// differs, orange: no local guess) and every page-wide detection (blue, dashed). With a merge, the boxes are
// the merged components instead, coloured by where each came from.
function htmlReport(loaded: LoadedPair, result: RecognitionResult, merged: Reconciled | null, diagram: DiagramResult | null): string {
    const { pair, image, request } = loaded;
    const type = IMAGE_TYPES[extname(pair.imagePath).toLowerCase()];
    const stroke = Math.max(2, Math.round(Math.max(request.image_width, request.image_height) / 250));
    const font = stroke * 6;
    const label = (x: number, y: number, color: string, text: string) =>
        `<text x="${x}" y="${y}" font-size="${font}" fill="${color}" stroke="#fff" stroke-width="${stroke / 3}" paint-order="stroke">${escapeHtml(text)}</text>`;
    const frame = (box: BoundingBox, color: string, dash = "") =>
        `<rect x="${box.x0}" y="${box.y0}" width="${box.x1 - box.x0}" height="${box.y1 - box.y0}" fill="none" stroke="${color}" stroke-width="${stroke}"${dash}/>`;
    const parts: string[] = [];
    const rows: string[] = [];
    if (merged !== null) {
        for (const component of merged.components) {
            const color = SOURCE_COLOR[component.source];
            parts.push(frame(component.box, color), label(component.box.x0 + stroke, component.box.y0 - stroke, color, `${component.label} ${percent(component.confidence)}`));
            rows.push(`<tr><td>${escapeHtml(component.source)}</td><td>${escapeHtml(component.label)}</td><td>${percent(component.confidence)}</td><td>${escapeHtml(component.localLabel ?? "-")}</td><td>${escapeHtml(component.modelLabel ?? "-")}</td><td>${escapeHtml(downstreamUse(component.label))}</td></tr>`);
        }
    } else {
        for (const prediction of firstPassOnly(result)) {
            const { region, label: local } = localGuess(loaded, prediction);
            rows.push(`<tr><td>${escapeHtml(prediction.region_id)}</td><td>${escapeHtml(local ?? "-")}</td><td>${escapeHtml(prediction.label)}</td><td>${percent(prediction.confidence)}</td><td>${escapeHtml(downstreamUse(prediction.label))}</td><td>${escapeHtml(alternativesText(prediction))}</td></tr>`);
            if (!region) continue;
            const verdict = agrees(local, prediction.label);
            const color = verdict === null ? "#f08c00" : verdict ? "#2f9e44" : "#e03131";
            parts.push(frame(region.box, color), label(region.box.x0 + stroke, region.box.y0 - stroke, color, `${prediction.label} ${percent(prediction.confidence)}`));
        }
    }
    for (const detection of result.detections) {
        parts.push(frame(detection.box, "#0c8599", ` stroke-dasharray="${stroke * 3} ${stroke * 2}"`), label(detection.box.x0 + stroke, detection.box.y1 + font, "#0c8599", `${detection.label} ${percent(detection.confidence)}`));
    }
    // The wiring the diagram was built from: a line for each connection, a dot on every pin used, a ring on each junction.
    const WIRE_COLOURS: Record<string, string> = { green: "#2f9e44", red: "#e03131", black: "#212529" };
    let diagramNote = "";
    if (diagram !== null) {
        const { overlay, ...counts } = diagram.report;
        for (const link of overlay.links) parts.push(`<line x1="${link.x1}" y1="${link.y1}" x2="${link.x2}" y2="${link.y2}" stroke="${WIRE_COLOURS[link.colour] ?? "#495057"}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${stroke * 2} ${stroke}" opacity="0.85"/>`);
        for (const pin of overlay.pins) parts.push(`<circle cx="${pin.x}" cy="${pin.y}" r="${stroke * 1.6}" fill="#fff" stroke="#212529" stroke-width="${stroke / 2}"/><text x="${pin.x + stroke * 2}" y="${pin.y - stroke}" font-size="${font * 0.8}" fill="#212529" stroke="#fff" stroke-width="${stroke / 3}" paint-order="stroke">${escapeHtml(`${pin.part}:${pin.pin}`)}</text>`);
        for (const node of overlay.nodes) parts.push(`<circle cx="${node.x}" cy="${node.y}" r="${stroke * 2.4}" fill="#fab005" stroke="#212529" stroke-width="${stroke / 2}"/><text x="${node.x + stroke * 3}" y="${node.y + stroke}" font-size="${font * 0.8}" fill="#212529" stroke="#fff" stroke-width="${stroke / 3}" paint-order="stroke">${escapeHtml(node.id)}</text>`);
        diagramNote = `<br>Wiring: ${counts.parts} parts, ${counts.connections} connections, ${counts.nodes} junction nodes (dashed lines, pins as white dots, junctions as yellow dots).${counts.dangling.length ? ` Wires that stop at one part: ${escapeHtml(counts.dangling.map((d) => `${d.part}:${d.pin}`).join(", "))}.` : ""}${counts.loose.length ? ` Parts nothing is wired to: ${escapeHtml(counts.loose.join(", "))}.` : ""}`;
    }
    const legend =
        merged !== null
            ? Object.entries(SOURCE_TEXT).map(([source, text]) => `<span style="color:${SOURCE_COLOR[source as Source]}">&#9632; ${escapeHtml(text)}</span>`).join(" &nbsp; ")
            : "Green: the model agrees with the local guess. Red: it differs. Orange: no local guess.";
    const head =
        merged !== null
            ? "<tr><th>source</th><th>label</th><th>confidence</th><th>first pass</th><th>model said</th><th>used as</th></tr>"
            : "<tr><th>region</th><th>local guess</th><th>model</th><th>confidence</th><th>used as</th><th>also</th></tr>";
    return `<!doctype html><meta charset="utf-8"><title>${escapeHtml(pair.name)}</title>
<style>body{font:14px system-ui;margin:1.5rem;background:#fafafa;color:#222}svg{max-width:100%;height:auto;background:#fff;border:1px solid #ccc}
table{border-collapse:collapse;margin-top:1rem}td,th{border:1px solid #ccc;padding:.25rem .6rem;text-align:left}</style>
<h1>${escapeHtml(pair.name)}</h1>
<p>label set ${escapeHtml(result.label_set_version)} | classifier ${escapeHtml(result.classifier_version ?? "none")} | detector ${escapeHtml(result.detector_version ?? "none")}.<br>${legend}${diagramNote}</p>
<svg viewBox="0 0 ${request.image_width} ${request.image_height}"><image href="data:${type};base64,${Buffer.from(image).toString("base64")}" width="${request.image_width}" height="${request.image_height}"/>${parts.join("")}</svg>
<table>${head}${rows.join("")}</table>`;
}

// Writes the raw response, the merged components and/or the HTML report of a pair into `outDir`.
export async function saveOutputs(outDir: string, loaded: LoadedPair, result: RecognitionResult, merged: Reconciled | null, diagram: DiagramResult | null, what: { html: boolean; json: boolean }) {
    if (!what.html && !what.json) return;
    await mkdir(outDir, { recursive: true });
    if (what.json) {
        await writeFile(join(outDir, `${loaded.pair.name}.result.json`), JSON.stringify(result, null, 2));
        if (merged !== null) await writeFile(join(outDir, `${loaded.pair.name}.merged.json`), JSON.stringify(merged.components, null, 2));
    }
    if (what.html) {
        const file = join(outDir, `${loaded.pair.name}.report.html`);
        await writeFile(file, htmlReport(loaded, result, merged, diagram));
        console.log(`report: ${file}`);
    }
}
