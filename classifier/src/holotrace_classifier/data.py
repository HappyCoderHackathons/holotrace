"""PyTorch datasets for symbol crops (classifier) and full pages (detector)."""

import json
from pathlib import Path

import numpy as np
import torch
from torch.utils.data import Dataset, WeightedRandomSampler

from .augment import augment_crop, augment_page
from .labels import LABEL_TO_INDEX
from .manifest import AnnotatedImage
from .preprocess import load_grayscale, normalize_page, page_to_tensor_array, to_model_input

IMAGE_SUFFIXES = {".png", ".jpg", ".jpeg"}
CROPS_META = "crops_meta.json"


class _WorkerRng:
    """Numpy generator created lazily inside each DataLoader worker so workers do not share a random stream."""

    _rng: np.random.Generator | None = None

    @property
    def rng(self) -> np.random.Generator:
        if self._rng is None:
            self._rng = np.random.default_rng(torch.initial_seed())
        return self._rng


def load_annotated_page(item: AnnotatedImage) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Flattened page plus boxes (N, 4) in page pixels and label indices (N,)."""
    gray = load_grayscale(item.image)
    h, w = gray.shape
    if item.width and item.height and (w, h) == (item.height, item.width) and w != h:
        # EXIF rotation disagrees with the annotation's coordinate frame; use the stored pixel order instead
        gray = load_grayscale(item.image, respect_exif=False)
        h, w = gray.shape
    sx = w / item.width if item.width else 1.0
    sy = h / item.height if item.height else 1.0

    page, scale = normalize_page(gray)
    boxes = np.array([o.box for o in item.objects], np.float32).reshape(-1, 4)
    boxes *= np.array([sx, sy, sx, sy], np.float32) * scale
    labels = np.array([LABEL_TO_INDEX[o.label] for o in item.objects], np.int64)
    return page, boxes, labels


def read_crops_meta(root: Path) -> dict:
    path = root / CROPS_META
    if not path.exists():
        raise FileNotFoundError(f"{path} not found; build crops with `holotrace-ml export-crops`")
    return json.loads(path.read_text(encoding="utf-8"))


class CropDataset(_WorkerRng, Dataset):
    """Directory-per-label crops produced by `export-crops`: <split_dir>/<label>/<name>.png"""

    def __init__(self, split_dir: Path, input_size: int, *, augment: bool, rotate90: bool = True) -> None:
        self.input_size = input_size
        self.augment = augment
        self.rotate90 = rotate90
        label_dirs = sorted(p for p in split_dir.iterdir() if p.is_dir())
        unknown = [p.name for p in label_dirs if p.name not in LABEL_TO_INDEX]
        if unknown:
            raise ValueError(f"{split_dir} has directories that are not labels: {unknown}")
        self.samples = [
            (path, LABEL_TO_INDEX[label_dir.name])
            for label_dir in label_dirs
            for path in sorted(label_dir.iterdir())
            if path.suffix.lower() in IMAGE_SUFFIXES
        ]
        if not self.samples:
            raise ValueError(f"no crops found in {split_dir}")

    @property
    def targets(self) -> list[int]:
        return [target for _, target in self.samples]

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, index: int) -> tuple[torch.Tensor, int]:
        path, target = self.samples[index]
        x = to_model_input(load_grayscale(path), self.input_size)
        if self.augment:
            x = augment_crop(x, self.rng, rotate90=self.rotate90)
        return torch.from_numpy(x).unsqueeze(0), target


def balanced_sampler(targets: list[int], num_classes: int) -> WeightedRandomSampler:
    """Sample with weight 1/sqrt(class count): lifts rare symbols without repeating a handful of crops endlessly."""
    targets_arr = np.asarray(targets)
    counts = np.bincount(targets_arr, minlength=num_classes).astype(np.float64)
    weights = 1.0 / np.sqrt(counts[targets_arr])
    return WeightedRandomSampler(torch.from_numpy(weights), num_samples=len(targets), replacement=True)


class PageDetectionDataset(_WorkerRng, Dataset):
    def __init__(self, items: list[AnnotatedImage], *, augment: bool, rotate90: bool = True) -> None:
        if not items:
            raise ValueError("detection dataset is empty")
        self.items = items
        self.augment = augment
        self.rotate90 = rotate90

    def __len__(self) -> int:
        return len(self.items)

    def __getitem__(self, index: int) -> tuple[torch.Tensor, dict[str, torch.Tensor]]:
        page, boxes, labels = load_annotated_page(self.items[index])
        if self.augment:
            page, boxes = augment_page(page, boxes, self.rng, rotate90=self.rotate90)
        keep = ((boxes[:, 2] - boxes[:, 0]) >= 1) & ((boxes[:, 3] - boxes[:, 1]) >= 1)
        target = {
            "boxes": torch.from_numpy(np.ascontiguousarray(boxes[keep])).reshape(-1, 4),
            "labels": torch.from_numpy(labels[keep]),
        }
        return torch.from_numpy(page_to_tensor_array(page)), target


def collate_detection(batch: list) -> tuple[list[torch.Tensor], list[dict[str, torch.Tensor]]]:
    images, targets = zip(*batch, strict=True)
    return list(images), list(targets)
