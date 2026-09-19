"""Cut classifier training crops from annotated pages.

Besides one crop per annotated symbol, this writes:
- jittered copies, so the classifier tolerates the loose boxes a local OpenCV pass will propose;
- background crops from empty regions, so the classifier can reject proposals that are not symbols.
"""

import json
from collections import Counter
from pathlib import Path

import numpy as np
import torch
from torchvision.ops import box_iou

from .data import CROPS_META, load_annotated_page
from .labels import BACKGROUND, LABEL_SET_VERSION, LABELS
from .manifest import SPLITS, read_manifest
from .preprocess import PREPROCESS_VERSION, extract_crop, limit_size, write_image


def _jitter(box: np.ndarray, rng: np.random.Generator, amount: float = 0.15) -> np.ndarray:
    w, h = box[2] - box[0], box[3] - box[1]
    shift = rng.uniform(-amount, amount, 2) * (w, h)
    grow = rng.uniform(1 - amount, 1 + amount, 2)
    cx, cy = (box[0] + box[2]) / 2 + shift[0], (box[1] + box[3]) / 2 + shift[1]
    nw, nh = w * grow[0] / 2, h * grow[1] / 2
    return np.array([cx - nw, cy - nh, cx + nw, cy + nh], np.float32)


def _background_boxes(
    boxes: np.ndarray, page_shape: tuple[int, int], count: int, rng: np.random.Generator, max_iou: float = 0.1
) -> list[np.ndarray]:
    h, w = page_shape
    sizes = boxes[:, 2:] - boxes[:, :2] if len(boxes) else np.array([[48.0, 48.0]])
    existing = torch.from_numpy(boxes) if len(boxes) else None
    found: list[np.ndarray] = []
    for _ in range(count * 25):
        if len(found) == count:
            break
        bw, bh = sizes[rng.integers(len(sizes))] * rng.uniform(0.7, 1.5)
        if bw >= w or bh >= h:
            continue
        x0, y0 = rng.uniform(0, w - bw), rng.uniform(0, h - bh)
        candidate = np.array([x0, y0, x0 + bw, y0 + bh], np.float32)
        if existing is not None and box_iou(torch.from_numpy(candidate[None]), existing).max() >= max_iou:
            continue
        found.append(candidate)
    return found


def export_crops(
    manifest_dir: Path,
    out_root: Path,
    *,
    context_pad: float,
    crop_max_side: int,
    jitter_copies: int,
    background_per_image: int,
    seed: int,
) -> dict:
    if (out_root / CROPS_META).exists():
        raise FileExistsError(f"{out_root} already contains crops; choose a new directory")
    rng = np.random.default_rng(seed)
    report: dict[str, dict[str, int]] = {}

    for split in SPLITS:
        manifest = manifest_dir / f"{split}.jsonl"
        if not manifest.exists():
            continue
        counts: Counter[str] = Counter()
        for label in LABELS:
            (out_root / split / label).mkdir(parents=True, exist_ok=True)
        items = read_manifest(manifest)
        for n, item in enumerate(items, 1):
            page, boxes, labels = load_annotated_page(item)
            stem = f"{item.group}_{item.image.stem}"
            for i, (box, label_index) in enumerate(zip(boxes, labels, strict=True)):
                label = LABELS[label_index]
                variants = [box] + [_jitter(box, rng) for _ in range(jitter_copies if split == "train" else 0)]
                for j, variant in enumerate(variants):
                    crop = limit_size(extract_crop(page, tuple(variant), context_pad), crop_max_side)
                    write_image(out_root / split / label / f"{stem}_{i:04d}_{j}.png", crop)
                    counts[label] += 1
            for i, box in enumerate(_background_boxes(boxes, page.shape, background_per_image, rng)):
                write_image(
                    out_root / split / BACKGROUND / f"{stem}_bg{i:03d}.png",
                    limit_size(extract_crop(page, tuple(box), context_pad), crop_max_side),
                )
                counts[BACKGROUND] += 1
            if n % 50 == 0 or n == len(items):
                print(f"{split}: {n}/{len(items)} pages, {sum(counts.values())} crops", flush=True)
        report[split] = dict(counts.most_common())

    meta = {
        "context_pad": context_pad,
        "crop_max_side": crop_max_side,
        "preprocess_version": PREPROCESS_VERSION,
        "label_set_version": LABEL_SET_VERSION,
        "counts": report,
    }
    (out_root / CROPS_META).write_text(json.dumps(meta, indent=2), encoding="utf-8")
    return meta
