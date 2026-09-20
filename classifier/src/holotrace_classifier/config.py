"""Training configuration loaded from TOML. Unknown keys are rejected so typos fail loudly."""

import json
import tomllib
import typing
from dataclasses import asdict, dataclass, field, fields, is_dataclass
from pathlib import Path


@dataclass
class OptimConfig:
    epochs: int = 40
    lr: float = 3e-3
    weight_decay: float = 5e-4
    momentum: float = 0.9
    warmup_epochs: float = 1.0
    label_smoothing: float = 0.05
    grad_clip: float = 1.0
    amp: bool = True
    early_stop_patience: int = 8
    # Classifier only. > 0: measure speed early in epoch 1, then cap epochs (at most `epochs`) so the run fits
    time_budget_hours: float = 0.0


@dataclass
class ClassifierDataConfig:
    root: Path = Path("data/crops")
    input_size: int = 96
    batch_size: int = 128
    num_workers: int = 4
    balance_classes: bool = True
    rotate90: bool = True


@dataclass
class ClassifierModelConfig:
    arch: str = "resnet_tiny"
    width: int = 32
    dropout: float = 0.2
    pretrained: bool = True


@dataclass
class ClassifierConfig:
    data: ClassifierDataConfig = field(default_factory=ClassifierDataConfig)
    model: ClassifierModelConfig = field(default_factory=ClassifierModelConfig)
    optim: OptimConfig = field(default_factory=OptimConfig)
    seed: int = 1337
    output_dir: Path = Path("runs/classifier")
    run_name: str = ""
    # Intra-op threads for training; 0 = PyTorch default (all cores). Leave cores free for data loader workers.
    threads: int = 0


@dataclass
class DetectorDataConfig:
    manifest_dir: Path = Path("data/manifests")
    batch_size: int = 4
    num_workers: int = 4
    rotate90: bool = True


@dataclass
class DetectorModelConfig:
    arch: str = "fasterrcnn_mobilenet_v3_large_fpn"
    pretrained: bool = True
    min_size: int = 1024
    max_size: int = 1600
    trainable_backbone_layers: int = 3
    anchor_scale: float = 0.5
    score_threshold: float = 0.3
    detections_per_image: int = 300


@dataclass
class DetectorConfig:
    data: DetectorDataConfig = field(default_factory=DetectorDataConfig)
    model: DetectorModelConfig = field(default_factory=DetectorModelConfig)
    optim: OptimConfig = field(
        default_factory=lambda: OptimConfig(epochs=30, lr=0.01, weight_decay=1e-4, label_smoothing=0.0)
    )
    seed: int = 1337
    output_dir: Path = Path("runs/detector")
    run_name: str = ""
    eval_every: int = 1
    eval_iou: float = 0.5


def _from_dict[T](cls: type[T], raw: dict[str, typing.Any], base: T) -> T:
    known = {f.name for f in fields(cls)}
    unknown = set(raw) - known
    if unknown:
        raise ValueError(f"unknown {cls.__name__} keys: {sorted(unknown)}")
    hints = typing.get_type_hints(cls)
    values = {}
    for name in known:
        current = getattr(base, name)
        if name not in raw:
            values[name] = current
        elif is_dataclass(hints[name]):
            values[name] = _from_dict(hints[name], raw[name], current)
        elif hints[name] is Path:
            values[name] = Path(raw[name])
        else:
            values[name] = raw[name]
    return cls(**values)


def load_config[T](cls: type[T], path: Path | None) -> T:
    if path is None:
        return cls()
    return _from_dict(cls, tomllib.loads(path.read_text(encoding="utf-8")), cls())


def config_to_json(config: object) -> str:
    return json.dumps(asdict(config), indent=2, default=str)
