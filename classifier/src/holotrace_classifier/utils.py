import json
import math
import os
import random
import time
from datetime import datetime
from pathlib import Path

import numpy as np
import torch
from torch import nn
from torch.optim.lr_scheduler import LambdaLR


def seed_everything(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)


def pick_device() -> torch.device:
    if torch.cuda.is_available():
        return torch.device("cuda")
    if torch.backends.mps.is_available():
        return torch.device("mps")
    return torch.device("cpu")


def make_run_dir(output_dir: Path, run_name: str) -> Path:
    run_dir = output_dir / (run_name or datetime.now().strftime("%Y%m%d-%H%M%S"))
    run_dir.mkdir(parents=True, exist_ok=False)
    return run_dir


def param_groups(model: nn.Module, weight_decay: float) -> list[dict]:
    """Weight decay on conv/linear weights only; decaying norm scales and biases hurts more than it helps."""
    decay, no_decay = [], []
    for param in model.parameters():
        if param.requires_grad:
            (no_decay if param.ndim <= 1 else decay).append(param)
    return [{"params": decay, "weight_decay": weight_decay}, {"params": no_decay, "weight_decay": 0.0}]


def warmup_cosine(optimizer: torch.optim.Optimizer, total_steps: int, warmup_steps: int) -> LambdaLR:
    """Linear warmup from ~0 to the base LR, then cosine decay to 0 over the remaining steps."""

    def factor(step: int) -> float:
        if step < warmup_steps:
            return (step + 1) / warmup_steps
        progress = (step - warmup_steps) / max(1, total_steps - warmup_steps)
        return 0.5 * (1 + math.cos(math.pi * min(progress, 1.0)))

    return LambdaLR(optimizer, factor)


def write_json_atomic(path: Path, data: object) -> None:
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(data), encoding="utf-8")
    os.replace(tmp, path)


class JsonlLogger:
    def __init__(self, path: Path) -> None:
        self.path = path

    def log(self, record: dict) -> None:
        with self.path.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(record | {"time": time.time()}) + "\n")
        summary = " ".join(f"{k}={v:.4f}" if isinstance(v, float) else f"{k}={v}" for k, v in record.items())
        print(summary, flush=True)


class Progress:
    """Throttled progress.json in the run directory, read by the training dashboard."""

    def __init__(self, run_dir: Path, epochs: int, steps: int, every_seconds: float = 5.0) -> None:
        self.path = run_dir / "progress.json"
        self.base = {"epochs": epochs, "steps": steps, "started": time.time()}
        self.every_seconds = every_seconds
        self._last = 0.0

    def update(self, phase: str, epoch: int, step: int, *, force: bool = False) -> None:
        now = time.time()
        if force or now - self._last >= self.every_seconds:
            self._last = now
            write_json_atomic(self.path, self.base | {"phase": phase, "epoch": epoch, "step": step, "time": now})
