// What a pipeline step is, and how its result is shown on the page.

import { Mat } from "../../src/lib/vision/cv";

// Each step takes the previous step's output and writes its own.
// `frame` is the untouched image the pipeline started from (the camera frame, or the captured
// still), for steps that draw on top of it. A `hidden` step still runs, but has no preview.
export type Step = { name: string; hidden?: boolean; apply: (input: Mat, output: Mat, frame: Mat) => void };

// Adds a labelled canvas to the page and returns its id.
export function makePreview(name: string): string {
    const id = `step-${name.toLowerCase().replace(/\s+/g, "-")}`;
    const figure = document.createElement("figure");
    const caption = document.createElement("figcaption");
    const canvas = document.createElement("canvas");
    caption.textContent = name;
    canvas.id = id;
    figure.append(caption, canvas);
    document.getElementById("steps")!.append(figure);
    return id;
}
