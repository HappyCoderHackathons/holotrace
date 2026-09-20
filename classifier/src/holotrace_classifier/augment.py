"""Training-time augmentation that imitates variation in hand-drawn, phone-captured diagrams.

Crop augmentations operate on the classifier's float ink map (ink=1, paper=0). Page augmentations operate on the
flattened uint8 page and transform boxes alongside the pixels.
"""

import cv2
import numpy as np

KERNEL_2X2 = np.ones((2, 2), np.uint8)


def augment_crop(x: np.ndarray, rng: np.random.Generator, *, rotate90: bool) -> np.ndarray:
    # Symbols are drawn in any orientation and mirroring preserves class for every label in the set
    if rotate90:
        x = np.rot90(x, int(rng.integers(4)))
    if rng.random() < 0.5:
        x = x[:, ::-1]
    x = np.ascontiguousarray(x)

    size = x.shape[0]
    center = size / 2
    matrix = cv2.getRotationMatrix2D((center, center), rng.uniform(-12, 12), rng.uniform(0.85, 1.1))
    shear = rng.uniform(-0.12, 0.12)
    matrix[0, 1] += shear
    matrix[0, 2] -= shear * center
    matrix[:, 2] += rng.uniform(-0.06, 0.06, size=2) * size
    x = cv2.warpAffine(x, matrix, (size, size), flags=cv2.INTER_LINEAR, borderValue=0)

    # Pen weight
    roll = rng.random()
    if roll < 0.15:
        x = cv2.dilate(x, KERNEL_2X2)
    elif roll < 0.3:
        x = cv2.erode(x, KERNEL_2X2)

    if rng.random() < 0.2:
        x = cv2.GaussianBlur(x, (3, 3), 0)
    x = x * rng.uniform(0.7, 1.1)
    if rng.random() < 0.3:
        x = x + rng.normal(0, rng.uniform(0.01, 0.05), x.shape).astype(np.float32)
    return np.clip(x, 0.0, 1.0).astype(np.float32)


def _rot90_ccw(page: np.ndarray, boxes: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    # np.rot90 maps (x, y) -> (y, W - x), so box x-range comes from y and y-range from the mirrored x-range
    width = page.shape[1]
    rotated = np.stack([boxes[:, 1], width - boxes[:, 2], boxes[:, 3], width - boxes[:, 0]], axis=1)
    return np.rot90(page), rotated


def _hflip(page: np.ndarray, boxes: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    width = page.shape[1]
    flipped = np.stack([width - boxes[:, 2], boxes[:, 1], width - boxes[:, 0], boxes[:, 3]], axis=1)
    return page[:, ::-1], flipped


def augment_page(
    page: np.ndarray, boxes: np.ndarray, rng: np.random.Generator, *, rotate90: bool
) -> tuple[np.ndarray, np.ndarray]:
    if rotate90:
        for _ in range(int(rng.integers(4))):
            page, boxes = _rot90_ccw(page, boxes)
    if rng.random() < 0.5:
        page, boxes = _hflip(page, boxes)
    page = np.ascontiguousarray(page)

    page = cv2.convertScaleAbs(page, alpha=rng.uniform(0.8, 1.2), beta=rng.uniform(-20, 20))
    if rng.random() < 0.2:
        page = cv2.GaussianBlur(page, (3, 3), 0)
    if rng.random() < 0.3:
        noise = rng.normal(0, rng.uniform(2, 8), page.shape)
        page = np.clip(page.astype(np.float32) + noise, 0, 255).astype(np.uint8)
    return page, boxes.astype(np.float32)
