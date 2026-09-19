"""Import the public CGHD dataset (https://github.com/DFKI/cghd) into Holotrace manifests.

Expected layout: <root>/drafter_N/{images,annotations}/CX_DY_PZ.{jpg,jpeg,xml}, annotations in Pascal VOC.
Splits are assigned per drafter to prevent a drafter's handwriting from leaking into evaluation.
"""

import random
import xml.etree.ElementTree as ET
from collections import Counter
from pathlib import Path

from .labels import BACKGROUND, LABEL_TO_INDEX
from .manifest import AnnotatedImage, AnnotatedObject, write_manifest

IMAGE_SUFFIXES = (".jpg", ".jpeg", ".png", ".JPG", ".JPEG", ".PNG")


def parse_voc(path: Path) -> tuple[int, int, list[tuple[str, tuple[float, float, float, float]]]]:
    root = ET.parse(path).getroot()
    size = root.find("size")
    width = int(float(size.findtext("width", "0"))) if size is not None else 0
    height = int(float(size.findtext("height", "0"))) if size is not None else 0
    objects = []
    for obj in root.iter("object"):
        bnd = obj.find("bndbox")
        if bnd is None:
            continue
        box = tuple(float(bnd.findtext(k, "nan")) for k in ("xmin", "ymin", "xmax", "ymax"))
        objects.append((obj.findtext("name", "").strip(), box))
    return width, height, objects


def _find_image(drafter: Path, stem: str) -> Path | None:
    for suffix in IMAGE_SUFFIXES:
        candidate = drafter / "images" / f"{stem}{suffix}"
        if candidate.exists():
            return candidate
    return None


def import_cghd(root: Path, out_dir: Path, *, val_drafters: int, test_drafters: int, seed: int) -> dict:
    drafters = sorted(p for p in root.iterdir() if p.is_dir() and p.name.startswith("drafter"))
    if len(drafters) <= val_drafters + test_drafters:
        raise ValueError(f"found {len(drafters)} drafters under {root}, need more than val+test")
    shuffled = drafters[:]
    random.Random(seed).shuffle(shuffled)
    assignment = {d: "test" for d in shuffled[:test_drafters]}
    assignment |= {d: "val" for d in shuffled[test_drafters : test_drafters + val_drafters]}
    assignment |= {d: "train" for d in shuffled[test_drafters + val_drafters :]}

    splits: dict[str, list[AnnotatedImage]] = {"train": [], "val": [], "test": []}
    kept, skipped_labels = Counter(), Counter()
    missing_images = invalid_boxes = 0

    for drafter in drafters:
        for xml_path in sorted((drafter / "annotations").glob("*.xml")):
            image = _find_image(drafter, xml_path.stem)
            if image is None:
                missing_images += 1
                continue
            width, height, raw_objects = parse_voc(xml_path)
            objects = []
            for name, (x0, y0, x1, y1) in raw_objects:
                if name == BACKGROUND or name not in LABEL_TO_INDEX:
                    skipped_labels[name] += 1
                    continue
                if width and height:
                    x0, x1 = max(0.0, x0), min(float(width), x1)
                    y0, y1 = max(0.0, y0), min(float(height), y1)
                if not (x1 > x0 and y1 > y0):
                    invalid_boxes += 1
                    continue
                objects.append(AnnotatedObject(name, (x0, y0, x1, y1)))
                kept[name] += 1
            splits[assignment[drafter]].append(
                AnnotatedImage(image.resolve(), width, height, drafter.name, "cghd", tuple(objects))
            )

    for split, items in splits.items():
        write_manifest(out_dir / f"{split}.jsonl", items)

    return {
        "drafters": {split: sorted(d.name for d, s in assignment.items() if s == split) for split in splits},
        "images": {split: len(items) for split, items in splits.items()},
        "objects_by_label": dict(kept.most_common()),
        "skipped_labels": dict(skipped_labels.most_common()),
        "missing_images": missing_images,
        "invalid_boxes": invalid_boxes,
    }
