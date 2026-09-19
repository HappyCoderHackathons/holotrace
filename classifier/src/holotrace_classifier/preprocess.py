"""Server-side preprocessing shared by training and inference.

Training and inference must run exactly the same steps, so every function here is used by both paths. Any change to
the output of these functions must bump PREPROCESS_VERSION; checkpoints record the version they were trained with
and inference refuses to load a mismatched checkpoint.

Pipeline:
    decode -> grayscale -> resize to PAGE_MAX_SIDE -> flatten illumination        (page level)
    crop box with context padding, downscale to at most crop_max_side              (classifier only)
    invert to ink, robust contrast stretch, letterbox to a square float image    (classifier only)
"""

from pathlib import Path

import cv2
import numpy as np

PREPROCESS_VERSION = "gray-flat-v1"

# Pages are downscaled to this longest side so stroke width is roughly consistent across camera resolutions.
PAGE_MAX_SIDE = 1600

# Closing kernel (pixels at PAGE_MAX_SIDE) used to estimate the paper background. Must exceed stroke width.
BACKGROUND_KERNEL = 25

Box = tuple[float, float, float, float]


def decode_grayscale(data: bytes, *, respect_exif: bool = True) -> np.ndarray:
    flags = cv2.IMREAD_GRAYSCALE if respect_exif else cv2.IMREAD_GRAYSCALE | cv2.IMREAD_IGNORE_ORIENTATION
    image = cv2.imdecode(np.frombuffer(data, np.uint8), flags)
    if image is None:
        raise ValueError("could not decode image")
    return image


def load_grayscale(path: Path, *, respect_exif: bool = True) -> np.ndarray:
    # read_bytes + imdecode instead of cv2.imread so non-ASCII Windows paths work
    return decode_grayscale(Path(path).read_bytes(), respect_exif=respect_exif)


def write_image(path: Path, image: np.ndarray) -> None:
    ok, buf = cv2.imencode(path.suffix or ".png", image)
    if not ok:
        raise ValueError(f"could not encode image for {path}")
    path.write_bytes(buf.tobytes())


def flatten_illumination(gray: np.ndarray, kernel: int = BACKGROUND_KERNEL) -> np.ndarray:
    """Divide out shadows, paper tone, and uneven lighting. Strokes stay dark on a ~255 background."""
    element = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (kernel, kernel))
    # Closing (dilate then erode) on dark-on-light removes strokes thinner than the kernel, leaving the paper.
    background = cv2.morphologyEx(gray, cv2.MORPH_CLOSE, element)
    background = cv2.GaussianBlur(background, (0, 0), kernel / 3)
    return cv2.divide(gray, background, scale=255)


def normalize_page(gray: np.ndarray, max_side: int = PAGE_MAX_SIDE) -> tuple[np.ndarray, float]:
    """Return the flattened page and the scale factor applied to source-pixel coordinates."""
    scale = min(1.0, max_side / max(gray.shape))
    if scale < 1.0:
        gray = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    return flatten_illumination(gray), scale


def extract_crop(page: np.ndarray, box: Box, context_pad: float) -> np.ndarray:
    """Crop a box plus surrounding context. Out-of-page area is filled with paper white."""
    x0, y0, x1, y1 = box
    pad = context_pad * max(x1 - x0, y1 - y0)
    left, top = round(x0 - pad), round(y0 - pad)
    right, bottom = max(round(x1 + pad), left + 2), max(round(y1 + pad), top + 2)
    h, w = page.shape
    crop = page[max(top, 0) : min(bottom, h), max(left, 0) : min(right, w)]
    borders = (max(-top, 0), max(bottom - h, 0), max(-left, 0), max(right - w, 0))
    if crop.size == 0:
        return np.full((bottom - top, right - left), 255, np.uint8)
    if any(borders):
        crop = cv2.copyMakeBorder(crop, *borders, cv2.BORDER_CONSTANT, value=255)
    return crop


def limit_size(image: np.ndarray, max_side: int) -> np.ndarray:
    """Downscale so the longest side is at most max_side. Stored training crops and live inference crops both pass
    through this, which bounds disk use for exported crops without breaking train/inference parity."""
    scale = max_side / max(image.shape)
    if scale >= 1:
        return image
    return cv2.resize(image, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)


def letterbox(image: np.ndarray, size: int) -> np.ndarray:
    """Resize the longest side to `size` and center on a zero (no ink) square canvas."""
    h, w = image.shape
    scale = size / max(h, w)
    nh, nw = max(1, round(h * scale)), max(1, round(w * scale))
    interpolation = cv2.INTER_AREA if scale < 1 else cv2.INTER_LINEAR
    resized = cv2.resize(image, (nw, nh), interpolation=interpolation)
    canvas = np.zeros((size, size), np.float32)
    y, x = (size - nh) // 2, (size - nw) // 2
    canvas[y : y + nh, x : x + nw] = resized
    return canvas


def to_model_input(crop: np.ndarray, size: int) -> np.ndarray:
    """Flattened uint8 crop -> float32 ink map in [0, 1], shape (size, size). Ink is 1, paper is 0."""
    ink = 255.0 - crop.astype(np.float32)
    # Stretch by a high percentile, floored so near-empty crops do not amplify sensor noise into fake strokes.
    ceiling = max(float(np.percentile(ink, 99.5)), 64.0)
    ink = np.clip(ink / ceiling, 0.0, 1.0)
    return letterbox(ink, size)


def page_to_tensor_array(page: np.ndarray) -> np.ndarray:
    """Flattened uint8 page -> float32 (3, H, W) in [0, 1] for ImageNet/COCO-pretrained detectors."""
    image = page.astype(np.float32) / 255.0
    return np.repeat(image[None], 3, axis=0)
