// Merging what the first pass proposed with what the model answered, so that neither has to be perfect. Pure
// geometry and labels, no OpenCV, so the app and a script can both use it.
//
// The first pass's own boxes ("region-N") are the anchors: they are precise and carry a local guess. The
// sweep windows ("sweep-N", see candidates.ts) are coarse but the model judges them independently of the
// first pass. Each anchor becomes a component in one of these ways:
//
//   first-pass  the model calls it a component: the model's label stands
//   relabelled  the model calls it a non-component (say "junction") but a sweep window over it is called a
//               component: the anchor's box, the sweep's label
//   kept        the model calls it a non-component and no sweep window disagrees, but the first pass was
//               sure of a name: the first pass's name stands (the model may not know this drawing style)
//
// And a confident sweep window over no anchor at all is a component the first pass missed:
//
//   sweep       the sweep's box and label
//
// An anchor that none of these apply to is dropped.

import { isSweepId } from "./candidates";
import {
    MERGE_ATTACH_IOU,
    MERGE_LOCAL_TRUST,
    MERGE_MAX_SIZE_RATIO,
    MERGE_MIN_CONFIDENCE,
    MERGE_MIN_SUPPORT,
    MERGE_SIZE_MIN_BOXES,
    MERGE_SUPPORT_IOU,
    MERGE_SWEEP_NMS,
} from "./config";
import { centreInside, type Corners, iouCorners as iou, longSideCorners as longSide } from "./boxes";
import { isComponentLabel, toClassifierLabel } from "./labels";

// What a request region and a model prediction hold that is needed here (the recognition-v0 JSON satisfies both).
export type ProposedRegion = { id: string; box: Corners; local_label: string | null; local_confidence: number | null };
export type Judgement = { region_id: string; label: string; confidence: number };

export type Source = "first-pass" | "relabelled" | "kept" | "sweep";

export type Component = {
    box: Corners;
    // A classifier label (cghd-v0).
    label: string;
    confidence: number;
    source: Source;
    // The request region this came from.
    regionId: string;
    // The first pass's guess for it, and what the model said about the box the first pass proposed.
    localLabel: string | null;
    modelLabel: string | null;
};

// Whether two boxes are over the same thing: they overlap enough, or one's centre is in the other.
const attaches = (a: Corners, b: Corners) => iou(a, b) >= MERGE_ATTACH_IOU || centreInside(a, b) || centreInside(b, a);

// The numbers reconcile goes by; the defaults are in config.ts. Passing others is for trying values out.
export type MergeOptions = { minConfidence: number; minSupport: number; supportIou: number };

export function reconcile(
    regions: ProposedRegion[],
    judgements: Judgement[],
    options: Partial<MergeOptions> = {},
): { components: Component[]; dropped: ProposedRegion[] } {
    const { minConfidence, minSupport, supportIou }: MergeOptions = { minConfidence: MERGE_MIN_CONFIDENCE, minSupport: MERGE_MIN_SUPPORT, supportIou: MERGE_SUPPORT_IOU, ...options };
    const judged = new Map(judgements.map((j) => [j.region_id, j]));
    const anchors = regions.filter((region) => !isSweepId(region.id));

    // The sweep windows the model is sure hold a component, one per place: the most confident of any that
    // overlap, and none that span two first-pass boxes (a window over several components names none of them),
    const confident = regions
        .filter((region) => isSweepId(region.id))
        .flatMap((region) => {
            const verdict = judged.get(region.id);
            return verdict !== undefined && isComponentLabel(verdict.label) && verdict.confidence >= minConfidence ? [{ region, verdict }] : [];
        })
        .sort((a, b) => b.verdict.confidence - a.verdict.confidence);
    // ... nor any that too few other windows agree with (see MERGE_MIN_SUPPORT); a sweep-only one needs the full
    // number, one over a first-pass box one fewer.
    const supported = confident
        .map((hit) => ({ ...hit, support: confident.filter((other) => other.verdict.label === hit.verdict.label && iou(other.region.box, hit.region.box) >= supportIou).length }))
        // (over a first-pass box one fewer will do: the first pass's own box is a vote too)
        .filter((hit) => hit.support >= minSupport - 1);
    // ... nor any much bigger than the first pass's typical box.
    const sizes = anchors.map((anchor) => longSide(anchor.box)).sort((a, b) => a - b);
    const typical = sizes.length >= MERGE_SIZE_MIN_BOXES ? sizes[Math.floor(sizes.length / 2)] : Infinity;
    const hits: typeof supported = [];
    for (const hit of supported) {
        const spansTwo = anchors.filter((anchor) => centreInside(anchor.box, hit.region.box)).length >= 2;
        const tooBig = longSide(hit.region.box) > MERGE_MAX_SIZE_RATIO * typical;
        if (!spansTwo && !tooBig && hits.every((kept) => iou(kept.region.box, hit.region.box) < MERGE_SWEEP_NMS)) hits.push(hit);
    }

    const components: Component[] = [];
    const dropped: ProposedRegion[] = [];
    const used = new Set<string>();
    for (const anchor of anchors) {
        const verdict = judged.get(anchor.id);
        const own = { box: anchor.box, regionId: anchor.id, localLabel: anchor.local_label, modelLabel: verdict?.label ?? null };
        if (verdict !== undefined && isComponentLabel(verdict.label)) {
            components.push({ ...own, label: verdict.label, confidence: verdict.confidence, source: "first-pass" });
            continue;
        }
        const over = hits.filter((hit) => !used.has(hit.region.id) && attaches(anchor.box, hit.region.box))[0];
        if (over !== undefined) {
            used.add(over.region.id);
            components.push({ ...own, label: over.verdict.label, confidence: over.verdict.confidence, source: "relabelled" });
            continue;
        }
        const trusted = anchor.local_label === null ? null : toClassifierLabel(anchor.local_label);
        if (trusted !== null && (anchor.local_confidence ?? 0) >= MERGE_LOCAL_TRUST) {
            components.push({ ...own, label: trusted, confidence: anchor.local_confidence ?? 0, source: "kept" });
            continue;
        }
        dropped.push(anchor);
    }

    // What is left of the sweep is what the first pass missed, unless it lies over a component already found.
    for (const hit of hits) {
        if (hit.support < minSupport || used.has(hit.region.id) || components.some((component) => attaches(component.box, hit.region.box))) continue;
        components.push({ box: hit.region.box, label: hit.verdict.label, confidence: hit.verdict.confidence, source: "sweep", regionId: hit.region.id, localLabel: null, modelLabel: hit.verdict.label });
    }
    components.sort((a, b) => a.box.y0 - b.box.y0 || a.box.x0 - b.box.x0);
    return { components, dropped };
}
