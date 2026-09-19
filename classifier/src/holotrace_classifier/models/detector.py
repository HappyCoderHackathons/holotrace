"""Full-page symbol detector: torchvision Faster R-CNN with a replaced class head and smaller anchors.

Input: list of (3, H, W) float tensors in [0, 1]. Training returns a loss dict; eval returns per-image
{"boxes", "labels", "scores"} in input-pixel coordinates.
"""

from torch import nn
from torchvision.models import MobileNet_V3_Large_Weights, ResNet50_Weights
from torchvision.models.detection import (
    FasterRCNN,
    FasterRCNN_MobileNet_V3_Large_FPN_Weights,
    FasterRCNN_ResNet50_FPN_V2_Weights,
    fasterrcnn_mobilenet_v3_large_fpn,
    fasterrcnn_resnet50_fpn_v2,
)
from torchvision.models.detection.anchor_utils import AnchorGenerator
from torchvision.models.detection.faster_rcnn import FastRCNNPredictor
from torchvision.ops import FrozenBatchNorm2d

from ..config import DetectorModelConfig


def _freeze_batchnorm(module: nn.Module) -> None:
    for name, child in module.named_children():
        if isinstance(child, nn.BatchNorm2d):
            setattr(module, name, FrozenBatchNorm2d(child.num_features))
        else:
            _freeze_batchnorm(child)


def build_detector(config: DetectorModelConfig, num_classes: int, *, download_weights: bool = True) -> FasterRCNN:
    """download_weights=False builds the same module structure as a pretrained model without fetching weights,
    for loading a checkpoint."""
    fetch = config.pretrained and download_weights
    kwargs = {
        "min_size": config.min_size,
        "max_size": config.max_size,
        "box_score_thresh": config.score_threshold,
        "box_detections_per_img": config.detections_per_image,
    }
    if fetch:
        kwargs["trainable_backbone_layers"] = config.trainable_backbone_layers
    match config.arch:
        case "fasterrcnn_mobilenet_v3_large_fpn":
            weights = FasterRCNN_MobileNet_V3_Large_FPN_Weights.DEFAULT if fetch else None
            backbone = MobileNet_V3_Large_Weights.DEFAULT if fetch else None
            model = fasterrcnn_mobilenet_v3_large_fpn(weights=weights, weights_backbone=backbone, **kwargs)
            # torchvision swaps in FrozenBatchNorm2d only when it loads pretrained weights; match that structure
            if config.pretrained and not download_weights:
                _freeze_batchnorm(model.backbone.body)
        case "fasterrcnn_resnet50_fpn_v2":
            weights = FasterRCNN_ResNet50_FPN_V2_Weights.DEFAULT if fetch else None
            backbone = ResNet50_Weights.DEFAULT if fetch else None
            model = fasterrcnn_resnet50_fpn_v2(weights=weights, weights_backbone=backbone, **kwargs)
        case _:
            raise ValueError(f"unknown detector arch {config.arch!r}")

    # COCO heads predict 91 classes; swap in a fresh head for the symbol label set
    in_features = model.roi_heads.box_predictor.cls_score.in_features
    model.roi_heads.box_predictor = FastRCNNPredictor(in_features, num_classes)

    # Junctions and crossovers are far smaller than typical COCO objects. Scaling anchor sizes keeps the same number
    # of anchors per location, so the pretrained RPN head shapes still match.
    generator = model.rpn.anchor_generator
    sizes = tuple(tuple(max(4, round(s * config.anchor_scale)) for s in level) for level in generator.sizes)
    model.rpn.anchor_generator = AnchorGenerator(sizes, generator.aspect_ratios)
    return model
