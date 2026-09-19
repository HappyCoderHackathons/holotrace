"""Crop classifiers. Input: (N, 1, S, S) ink maps in [0, 1]. Output: (N, num_classes) logits.

resnet_tiny is written out in full and trained from scratch; mobilenet_v3_small fine-tunes an ImageNet backbone.
Comparing the two on the same crops is a useful first experiment.
"""

import torch
from torch import nn
from torchvision.models import MobileNet_V3_Small_Weights, mobilenet_v3_small

from ..config import ClassifierModelConfig


class BasicBlock(nn.Module):
    """Two 3x3 convs with a residual shortcut (He et al., 2015). The shortcut projects when shape changes."""

    def __init__(self, in_channels: int, out_channels: int, stride: int) -> None:
        super().__init__()
        self.conv1 = nn.Conv2d(in_channels, out_channels, 3, stride, 1, bias=False)
        self.bn1 = nn.BatchNorm2d(out_channels)
        self.conv2 = nn.Conv2d(out_channels, out_channels, 3, 1, 1, bias=False)
        self.bn2 = nn.BatchNorm2d(out_channels)
        self.shortcut = nn.Identity()
        if stride != 1 or in_channels != out_channels:
            self.shortcut = nn.Sequential(
                nn.Conv2d(in_channels, out_channels, 1, stride, bias=False), nn.BatchNorm2d(out_channels)
            )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        out = torch.relu(self.bn1(self.conv1(x)))
        out = self.bn2(self.conv2(out))
        return torch.relu(out + self.shortcut(x))


class ResNetTiny(nn.Module):
    """~2.8M params at width 32. 96px input -> stem /2 -> stages /1,/2,/2,/2 -> 6x6 feature map -> pooled logits."""

    def __init__(self, num_classes: int, width: int = 32, dropout: float = 0.2) -> None:
        super().__init__()
        self.stem = nn.Sequential(
            nn.Conv2d(1, width, 3, 2, 1, bias=False), nn.BatchNorm2d(width), nn.ReLU(inplace=True)
        )
        stages, channels = [], width
        for i, multiplier in enumerate((1, 2, 4, 8)):
            out_channels = width * multiplier
            stride = 1 if i == 0 else 2
            stages += [BasicBlock(channels, out_channels, stride), BasicBlock(out_channels, out_channels, 1)]
            channels = out_channels
        self.stages = nn.Sequential(*stages)
        self.head = nn.Sequential(
            nn.AdaptiveAvgPool2d(1), nn.Flatten(), nn.Dropout(dropout), nn.Linear(channels, num_classes)
        )
        self._init_weights()

    def _init_weights(self) -> None:
        for m in self.modules():
            if isinstance(m, nn.Conv2d):
                nn.init.kaiming_normal_(m.weight, mode="fan_out", nonlinearity="relu")
            elif isinstance(m, nn.BatchNorm2d):
                nn.init.ones_(m.weight)
                nn.init.zeros_(m.bias)
        # Zero the last BN in each residual branch so every block starts as identity; stabilizes early training
        for m in self.modules():
            if isinstance(m, BasicBlock):
                nn.init.zeros_(m.bn2.weight)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.head(self.stages(self.stem(x)))


class MobileNetClassifier(nn.Module):
    def __init__(self, num_classes: int, pretrained: bool, dropout: float) -> None:
        super().__init__()
        self.net = mobilenet_v3_small(weights=MobileNet_V3_Small_Weights.DEFAULT if pretrained else None)
        self.net.classifier[2] = nn.Dropout(dropout)
        self.net.classifier[3] = nn.Linear(self.net.classifier[3].in_features, num_classes)
        self.register_buffer("mean", torch.tensor([0.485, 0.456, 0.406]).view(1, 3, 1, 1))
        self.register_buffer("std", torch.tensor([0.229, 0.224, 0.225]).view(1, 3, 1, 1))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net((x.expand(-1, 3, -1, -1) - self.mean) / self.std)


def build_classifier(config: ClassifierModelConfig, num_classes: int) -> nn.Module:
    match config.arch:
        case "resnet_tiny":
            return ResNetTiny(num_classes, config.width, config.dropout)
        case "mobilenet_v3_small":
            return MobileNetClassifier(num_classes, config.pretrained, config.dropout)
        case _:
            raise ValueError(f"unknown classifier arch {config.arch!r}")
