"""Holotrace annotation manifest: one JSON object per line, one line per annotated page image.

{"image": "/abs/path.jpg", "width": 4032, "height": 3024, "group": "drafter_3", "source": "cghd",
 "objects": [{"label": "resistor", "box": [x0, y0, x1, y1]}]}

Boxes are in the pixel coordinates of the annotation's declared width/height. `group` is the unit used to split
data (a drafter for CGHD) so the same hand never appears in both train and evaluation splits.
"""

import json
from dataclasses import dataclass
from pathlib import Path

from .labels import LABEL_TO_INDEX

SPLITS = ("train", "val", "test")


@dataclass(frozen=True)
class AnnotatedObject:
    label: str
    box: tuple[float, float, float, float]


@dataclass(frozen=True)
class AnnotatedImage:
    image: Path
    width: int
    height: int
    group: str
    source: str
    objects: tuple[AnnotatedObject, ...]


def write_manifest(path: Path, items: list[AnnotatedImage]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as fh:
        for item in items:
            record = {
                "image": str(item.image),
                "width": item.width,
                "height": item.height,
                "group": item.group,
                "source": item.source,
                "objects": [{"label": o.label, "box": list(o.box)} for o in item.objects],
            }
            fh.write(json.dumps(record) + "\n")


def read_manifest(path: Path) -> list[AnnotatedImage]:
    items = []
    with path.open(encoding="utf-8") as fh:
        for line_no, line in enumerate(fh, 1):
            if not line.strip():
                continue
            record = json.loads(line)
            objects = []
            for obj in record["objects"]:
                if obj["label"] not in LABEL_TO_INDEX:
                    raise ValueError(f"{path}:{line_no}: unknown label {obj['label']!r}")
                objects.append(AnnotatedObject(obj["label"], tuple(obj["box"])))
            items.append(
                AnnotatedImage(
                    image=Path(record["image"]),
                    width=record["width"],
                    height=record["height"],
                    group=record["group"],
                    source=record["source"],
                    objects=tuple(objects),
                )
            )
    return items
