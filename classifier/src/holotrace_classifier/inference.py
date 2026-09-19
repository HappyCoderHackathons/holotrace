from dataclasses import fields, replace
from pathlib import Path

import numpy as np
import torch
from torch import nn

from .config import ClassifierModelConfig, DetectorModelConfig
from .contracts import (
    BoundingBox,
    Detection,
    LabelScore,
    RecognitionRequest,
    RecognitionResult,
    RegionPrediction,
)
from .labels import LABEL_SET_VERSION
from .models import build_classifier, build_detector
from .preprocess import (
    PREPROCESS_VERSION,
    decode_grayscale,
    extract_crop,
    limit_size,
    normalize_page,
    to_model_input,
)
from .utils import pick_device


def _model_config[T](cls: type[T], ckpt: dict) -> T:
    known = {f.name for f in fields(cls)}
    return cls(**{k: v for k, v in ckpt["model_config"].items() if k in known})


def load_checkpoint(path: Path, kind: str, device: torch.device) -> tuple[nn.Module, dict]:
    ckpt = torch.load(path, map_location=device, weights_only=True)
    if ckpt.get("kind") != kind:
        raise ValueError(f"{path} is a {ckpt.get('kind')!r} checkpoint, expected {kind!r}")
    if ckpt["preprocess_version"] != PREPROCESS_VERSION:
        raise ValueError(
            f"{path} was trained with preprocessing {ckpt['preprocess_version']!r}, "
            f"this code implements {PREPROCESS_VERSION!r}"
        )
    # Weights come from the checkpoint, so never download ImageNet/COCO weights here
    num_classes = len(ckpt["labels"])
    if kind == "classifier":
        model = build_classifier(replace(_model_config(ClassifierModelConfig, ckpt), pretrained=False), num_classes)
    else:
        model = build_detector(_model_config(DetectorModelConfig, ckpt), num_classes, download_weights=False)
    model.load_state_dict(ckpt["state_dict"])
    model.to(device).eval()
    return model, ckpt


class Recognizer:
    def __init__(
        self,
        classifier_path: Path | None = None,
        detector_path: Path | None = None,
        device: torch.device | None = None,
    ) -> None:
        if classifier_path is None and detector_path is None:
            raise ValueError("at least one of classifier or detector checkpoint is required")
        self.device = device or pick_device()
        self.classifier, self.classifier_meta = (
            load_checkpoint(classifier_path, "classifier", self.device) if classifier_path else (None, None)
        )
        self.detector, self.detector_meta = (
            load_checkpoint(detector_path, "detector", self.device) if detector_path else (None, None)
        )
        for meta in (self.classifier_meta, self.detector_meta):
            if meta and meta["label_set_version"] != LABEL_SET_VERSION:
                raise ValueError(f"checkpoint label set {meta['label_set_version']!r} != {LABEL_SET_VERSION!r}")

    @torch.inference_mode()
    def recognize(self, image: bytes, request: RecognitionRequest, top_k: int = 3) -> RecognitionResult:
        gray = decode_grayscale(image)
        if gray.shape != (request.image_height, request.image_width):
            raise ValueError(
                f"image is {gray.shape[1]}x{gray.shape[0]}, request says {request.image_width}x{request.image_height}"
            )
        page, scale = normalize_page(gray)
        return RecognitionResult(
            label_set_version=LABEL_SET_VERSION,
            preprocess_version=PREPROCESS_VERSION,
            client_preprocess_version=request.client_preprocess_version,
            classifier_version=self.classifier_meta["model_version"] if self.classifier_meta else None,
            detector_version=self.detector_meta["model_version"] if self.detector_meta else None,
            regions=self._classify(page, scale, request, top_k) if self.classifier else [],
            detections=self._detect(page, scale) if self.detector else [],
        )

    def _classify(
        self, page: np.ndarray, scale: float, request: RecognitionRequest, top_k: int
    ) -> list[RegionPrediction]:
        if not request.regions:
            return []
        meta = self.classifier_meta
        crops = [
            to_model_input(
                limit_size(
                    extract_crop(page, tuple(v * scale for v in r.box.as_tuple()), meta["context_pad"]),
                    meta["crop_max_side"],
                ),
                meta["input_size"],
            )
            for r in request.regions
        ]
        batch = torch.from_numpy(np.stack(crops)).unsqueeze(1).to(self.device)
        probs = self.classifier(batch).softmax(1).cpu()
        scores, indices = probs.topk(min(top_k, probs.shape[1]), dim=1)
        labels = meta["labels"]
        return [
            RegionPrediction(
                region_id=region.id,
                label=labels[idx[0]],
                confidence=float(score[0]),
                alternatives=[
                    LabelScore(label=labels[i], confidence=float(s)) for s, i in zip(score[1:], idx[1:], strict=True)
                ],
                local_label=region.local_label,
            )
            for region, score, idx in zip(request.regions, scores.tolist(), indices.tolist(), strict=True)
        ]

    def _detect(self, page: np.ndarray, scale: float) -> list[Detection]:
        image = torch.from_numpy(page).float().div(255).expand(3, -1, -1).to(self.device)
        output = self.detector([image])[0]
        labels = self.detector_meta["labels"]
        return [
            Detection(
                box=BoundingBox(**dict(zip(("x0", "y0", "x1", "y1"), (v / scale for v in box), strict=True))),
                label=labels[label],
                confidence=score,
            )
            for box, label, score in zip(
                output["boxes"].cpu().tolist(), output["labels"].tolist(), output["scores"].tolist(), strict=True
            )
        ]
