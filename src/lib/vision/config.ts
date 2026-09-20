// Every tunable number in the first pass, in one place.
// Sizes marked "detection frame" are measured on the downscaled frame (DETECT_WIDTH wide) and
// are multiplied by state.detectScale when applied to the full-resolution capture.

export type Color = [number, number, number, number];

// ---- Camera ----

// The camera is always used at its native (largest) resolution; see openCamera in main.ts.

// Circuit detection runs on a copy scaled down to this width, to stay fast.
export const DETECT_WIDTH = 640;
// Key that returns to the live camera after a capture (the Reset button does the same).
export const RESET_KEY = "r";

// ---- Ink ----

// Ink threshold: neighbourhood size and offset (detection frame).
export const INK_BLOCK_SIZE = 21;
export const INK_OFFSET = 10;
// The still picks its own offset: the ink shrinks fast as the offset grows while it is still
// picking up ruled lines and paper grain, then slowly. It takes the first offset (of this range and
// step) after which the ink shrinks by less than INK_ELBOW of the whole range's shrinkage, plus one step.
export const INK_OFFSET_MIN = 6;
export const INK_OFFSET_MAX = 26;
export const INK_OFFSET_STEP = 2;
export const INK_ELBOW = 0.1;
// The live camera looks for the circuit with these, in order, until one finds it. Ruled paper joins
// into one page-wide blob at the first setting, so a stricter offset comes next; up close, strokes are
// thick and often out of focus, which a wider neighbourhood and a lower offset pick up.
export const LIVE_INK_ATTEMPTS: [blockSize: number, offset: number][] = [
    [INK_BLOCK_SIZE, INK_OFFSET],
    [INK_BLOCK_SIZE, 20],
    [41, 8],
    [61, 5],
];

// ---- Finding the circuit in the live camera ----

// The circuit must cover at least this fraction of the frame, or it is just noise.
export const MIN_CIRCUIT_FRACTION = 0.02;
// At most this fraction; anything bigger is the page or background, not a circuit.
export const MAX_CIRCUIT_FRACTION = 0.8;
// The circuit must sit at least this many pixels inside the frame, so it is fully in view.
export const EDGE_MARGIN = 4;
// How large a gap in the drawing still counts as one circuit (detection frame).
export const BLOB_KERNEL = 15;
// A circuit must enclose a hole (a closed loop) at least this fraction of its box, so a
// half-drawn or half-visible circuit is not captured.
export const MIN_HOLE_FRACTION = 0.1;

// ---- Taking the screenshot ----

// The circuit must hold still for this long (charged up, see HOLD_DRAIN) before a screenshot is taken. A circuit that is not
// a closed loop (an amplifier stage, say) could also be half drawn, so it must hold still longer.
export const HOLD_MS = 1500;
export const HOLD_OPEN_MS = 3500;
// The charge drains at this many times the speed it fills when the circuit is lost or moves, so a
// brief flicker costs little but a real absence still resets it.
export const HOLD_DRAIN = 0.5;
// How much the box may move between frames and still count as holding still
// (intersection over union).
export const STABLE_IOU = 0.85;
// Extra pixels kept around the circuit in the screenshot (detection frame).
export const CAPTURE_PADDING = 20;
// Id of the canvas that shows the screenshot.
export const CAPTURE_CANVAS_ID = "step-captured-circuit";

// ---- Sharpening (unsharp mask) ----

// How wide a blur is subtracted, and how strongly.
export const SHARPEN_SIGMA = 1.5;
export const SHARPEN_AMOUNT = 2;

// ---- Components: the lamp, battery, resistor, gate and so on (see vision/components.ts) ----
// Sizes are measured in pen-stroke widths, so they suit thick and thin pens alike.

// A component is either a closed body (a gate, a lamp) or a solid scribble (a battery, a resistor).
// Junction dots, wires and text are neither, which is what keeps them out.

// Bodies: the ink is closed by this many strokes, so a gate outline with small gaps where wires join
// still encloses its inside. Holes (enclosed areas) that are this many strokes across at the
// longest, at most BODY_MAX_STROKES, at least BODY_MIN_SOLIDITY compact (area over the area of the
// convex outline) and at least BODY_MIN_ASPECT square (short side over long side) are bodies. Wire
// loops between rails fail on size or on aspect.
export const BODY_CLOSE_STROKES = 4;
export const BODY_MIN_STROKES = 5;
export const BODY_MAX_STROKES = 30;
export const BODY_MIN_SOLIDITY = 0.7;
export const BODY_MIN_ASPECT = 0.62;
// Rings: a lamp's cross splits its ring into wedges that a wide closing would fill in. So holes of
// a light closing (RING_CLOSE_STROKES), at least RING_PIECE_STROKES across, are grouped when they lie
// within MERGE_GAP_STROKES of each other, and a group counts as a body if it is at least
// RING_MIN_STROKES across and passes the same size and aspect limits. This also finds small
// switch loops.
export const RING_CLOSE_STROKES = 1.5;
export const RING_PIECE_STROKES = 2;
export const RING_MIN_STROKES = 2.2;
// A ring no bigger than RING_SMALL_STROKES is a switch contact or a terminal, and its box grows by
// RING_REACH_STROKES on every side to take in the arm and wire stubs that make it a switch.
export const RING_SMALL_STROKES = 6;
export const RING_REACH_STROKES = 5;
export const MERGE_GAP_STROKES = 2;
// Solids: ink closed by SOLID_CLOSE_STROKES and then opened by SOLID_OPEN_STROKES keeps only filled
// blocks (single strokes and small dots vanish); closing this wide also fuses a zigzag resistor or a
// battery's parallel lines into one. One is a component if it is SOLID_MIN_STROKES to BODY_MAX_STROKES
// across, at least SOLID_MIN_ASPECT square (a pair of wires fuses into a long thin band) and at least
// SOLID_MIN_FILL of its box is real ink.
export const SOLID_CLOSE_STROKES = 3;
export const SOLID_OPEN_STROKES = 2;
export const SOLID_MIN_STROKES = 6;
export const SOLID_MIN_ASPECT = 0.25;
export const SOLID_MIN_FILL = 0.2;
// A box less than 1 / SCRAP_RATIO of the area of a box it touches is a scrap of that one's wiring.
export const SCRAP_RATIO = 2.5;
// A component is at most this fraction of the image's area, and gets this much room around its box, in strokes.
export const COMPONENT_MAX_AREA_FRACTION = 0.25;
export const COMPONENT_PAD_STROKES = 2;
// A box within this many strokes of the crop's edge is dropped (see findComponents).
export const EDGE_STROKES = 3;

// ---- Naming the components (see vision/classify.ts and vision/symbols.ts) ----

// Each component is shown with this much room around it, in strokes.
export const COMPONENT_CROP_MARGIN_STROKES = 8;
// Its ink is shrunk to a square this many pixels across and blurred by this much before it is compared
// to the reference symbols.
export const MATCH_SIZE = 48;
export const MATCH_BLUR_SIGMA = 3;
// A symbol's score is multiplied by this when the box is outside the size range that symbol is
// drawn at (see SymbolDrawing.strokes).
export const SIZE_MISMATCH = 0.6;
// A component gets the best symbol's own name if it matches at least this well (0 to 1), and only the
// name of its group (a gate is a "logic_gate") if it matches at least LABEL_MIN_GROUP_CONFIDENCE. Below
// that there is no good guess, and the JSON keeps local_label and local_confidence null.
export const LABEL_MIN_CONFIDENCE = 0.55;
export const LABEL_MIN_GROUP_CONFIDENCE = 0.4;

// ---- Proposing more than the first pass finds, and merging the model's answer (see candidates.ts and reconcile.ts) ----

// The first pass cannot find everything, so the boxes it finds can be joined by a sweep: square windows laid
// over the whole image, which the classifier then accepts or rejects (it has a "background" label for
// boxes that are not symbols). Windows are these fractions of the image's longer side, and move by
// SWEEP_STRIDE of their size. On the app's side, a window needs at least SWEEP_MIN_INK_FRACTION ink to be
// sent. A request holds at most MAX_PROPOSALS regions (the service takes 2048).
export const SWEEP_SIZE_FRACTIONS = [0.07, 0.1, 0.15, 0.2];
export const SWEEP_STRIDE = 0.5;
export const SWEEP_MIN_INK_FRACTION = 0.02;
export const MAX_PROPOSALS = 2000;

// Merging: a sweep window counts only if the model gives it a component label with at least
// MERGE_MIN_CONFIDENCE. It belongs to a first-pass box when the two overlap by at least MERGE_ATTACH_IOU (or one's centre lies in the other), and sweep windows overlapping each other by MERGE_SWEEP_NMS are one. A
// first-pass box the model calls a non-component is still kept when the first pass was at least
// MERGE_LOCAL_TRUST sure of a name.
export const MERGE_MIN_CONFIDENCE = 0.6;
// The merge leans toward finding things: a person fixes it up in the review step afterwards, and each component
// carries its source and confidence for that. Still, a real symbol is hit by several overlapping windows and
// junk (a window over wiring) usually by one, so a sweep window counts only if at least MERGE_MIN_SUPPORT
// windows (itself included) that overlap it by at least MERGE_SUPPORT_IOU are given the same component label
// by the model. (On five sample photos: 3 needs 0.8 confidence to keep out junk, 2 with 0.6 finds a few more
// real symbols and lets a few junk boxes through, 1 lets in a lot.)
export const MERGE_MIN_SUPPORT = 2;
export const MERGE_SUPPORT_IOU = 0.25;
export const MERGE_ATTACH_IOU = 0.15;
export const MERGE_SWEEP_NMS = 0.3;
export const MERGE_LOCAL_TRUST = 0.75;
// A sweep window is shrunk to the ink inside it (plus SWEEP_TIGHT_PAD pixels at detection size) before merging, so
// windows over one symbol land on the same box. A component found only by the sweep that is more than
// MERGE_MAX_SIZE_RATIO times the size of the typical first-pass box is a window over several things, and is
// ignored (judged only when the first pass found at least MERGE_SIZE_MIN_BOXES boxes).
export const SWEEP_TIGHT_PAD = 3;
export const MERGE_MAX_SIZE_RATIO = 1.6;
export const MERGE_SIZE_MIN_BOXES = 3;

// ---- Tracing the wires between components (see wires.ts) ----

// Wires are traced on a copy scaled so that a pen stroke is about this many pixels wide, which keeps big photos fast.
export const WIRE_TRACE_STROKE_PIXELS = 3;
// Gaps in a wire up to this many strokes wide are bridged (a hand-drawn wire is rarely unbroken).
export const WIRE_CLOSE_STROKES = 2;
// A piece of ink whose longer side is under this many strokes is a speck or text, not a wire.
export const WIRE_MIN_STROKES = 4;
// A wire touches a component if it comes within this many strokes of its box.
export const WIRE_CONTACT_REACH_STROKES = 2;
// Contacts of one wire on one component closer together than this many strokes are one contact.
export const WIRE_CONTACT_MERGE_STROKES = 3;
// How well the ink must match a textbook drawing before the way that drawing is turned is believed (0 to 1).
export const ORIENTATION_MIN_SCORE = 0.5;

// ---- Files the dev page downloads (also read by circuit-stuff/recognize.ts to pair them up) ----

export const DOWNLOAD_JSON_NAME = "recognition.json";
export const DOWNLOAD_IMAGE_NAME = "captured-circuit.png";

// ---- Preview colours ----

export const COMPONENT_COLOR: Color = [255, 140, 0, 255];
