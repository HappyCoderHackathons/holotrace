import math
from dataclasses import asdict
from pathlib import Path

import torch
from torch import nn
from torch.utils.data import DataLoader

from .config import DetectorConfig, config_to_json
from .data import PageDetectionDataset, collate_detection
from .labels import LABEL_SET_VERSION, LABELS
from .manifest import read_manifest
from .metrics import detection_ap
from .models import build_detector
from .preprocess import PAGE_MAX_SIDE, PREPROCESS_VERSION
from .utils import JsonlLogger, make_run_dir, param_groups, pick_device, seed_everything, warmup_cosine


@torch.inference_mode()
def evaluate_detector(model: nn.Module, loader: DataLoader, device: torch.device, iou_threshold: float) -> dict:
    model.eval()
    # A low score floor during evaluation so AP integrates over the full precision/recall curve
    serving_threshold = model.roi_heads.score_thresh
    model.roi_heads.score_thresh = 0.05
    predictions, ground_truth = [], []
    try:
        for images, targets in loader:
            outputs = model([image.to(device) for image in images])
            predictions += [{k: v.cpu() for k, v in out.items()} for out in outputs]
            ground_truth += targets
    finally:
        model.roi_heads.score_thresh = serving_threshold
    return detection_ap(predictions, ground_truth, LABELS, iou_threshold)


def train_detector(config: DetectorConfig) -> Path:
    seed_everything(config.seed)
    device = pick_device()
    data = config.data
    train_set = PageDetectionDataset(
        read_manifest(data.manifest_dir / "train.jsonl"), augment=True, rotate90=data.rotate90
    )
    val_set = PageDetectionDataset(read_manifest(data.manifest_dir / "val.jsonl"), augment=False)
    loader_args = {
        "batch_size": data.batch_size,
        "num_workers": data.num_workers,
        "collate_fn": collate_detection,
        "pin_memory": device.type == "cuda",
        "persistent_workers": data.num_workers > 0,
    }
    train_loader = DataLoader(train_set, shuffle=True, drop_last=True, **loader_args)
    val_loader = DataLoader(val_set, shuffle=False, **loader_args)

    model = build_detector(config.model, len(LABELS)).to(device)
    optim = config.optim
    optimizer = torch.optim.SGD(
        param_groups(model, optim.weight_decay), lr=optim.lr, momentum=optim.momentum, nesterov=True
    )
    steps = len(train_loader)
    scheduler = warmup_cosine(optimizer, optim.epochs * steps, int(optim.warmup_epochs * steps))
    use_amp = optim.amp and device.type == "cuda"
    scaler = torch.amp.GradScaler("cuda", enabled=use_amp)

    run_dir = make_run_dir(config.output_dir, config.run_name)
    (run_dir / "config.json").write_text(config_to_json(config), encoding="utf-8")
    logger = JsonlLogger(run_dir / "metrics.jsonl")
    print(f"device={device} train={len(train_set)} val={len(val_set)} run_dir={run_dir}", flush=True)

    def checkpoint(epoch: int, metrics: dict) -> dict:
        return {
            "kind": "detector",
            "model_version": f"{config.model.arch}-{run_dir.name}",
            "model_config": asdict(config.model),
            "labels": list(LABELS),
            "label_set_version": LABEL_SET_VERSION,
            "preprocess_version": PREPROCESS_VERSION,
            "page_max_side": PAGE_MAX_SIDE,
            "epoch": epoch,
            "metrics": metrics,
            "state_dict": model.state_dict(),
        }

    best, stale, metrics = -1.0, 0, {}
    for epoch in range(1, optim.epochs + 1):
        model.train()
        totals: dict[str, float] = {}
        for step, (images, targets) in enumerate(train_loader, 1):
            images = [image.to(device, non_blocking=True) for image in images]
            targets = [{k: v.to(device, non_blocking=True) for k, v in t.items()} for t in targets]
            with torch.autocast(device.type, enabled=use_amp):
                # RPN objectness/box losses + ROI head classification/box regression losses
                losses = model(images, targets)
                loss = sum(losses.values())
            if not math.isfinite(loss.item()):
                raise FloatingPointError(f"non-finite loss at epoch {epoch} step {step}: {losses}")
            optimizer.zero_grad(set_to_none=True)
            scaler.scale(loss).backward()
            scaler.unscale_(optimizer)
            nn.utils.clip_grad_norm_(model.parameters(), optim.grad_clip)
            scaler.step(optimizer)
            scaler.update()
            scheduler.step()
            for name, value in losses.items():
                totals[name] = totals.get(name, 0.0) + value.item()
            if step % 20 == 0:
                print(f"epoch {epoch} step {step}/{steps} loss={loss.item():.4f}", flush=True)

        record = {"epoch": epoch, "lr": scheduler.get_last_lr()[0]}
        record |= {f"train_{name}": total / steps for name, total in totals.items()}
        if epoch % config.eval_every == 0 or epoch == optim.epochs:
            metrics = evaluate_detector(model, val_loader, device, config.eval_iou)
            record["val_map"] = metrics["map"]
            if metrics["map"] > best:
                best, stale = metrics["map"], 0
                torch.save(checkpoint(epoch, metrics), run_dir / "best.pt")
            else:
                stale += 1
        logger.log(record)
        if stale >= optim.early_stop_patience:
            print(f"early stop: no val mAP improvement for {stale} evaluations", flush=True)
            break

    torch.save(checkpoint(epoch, metrics), run_dir / "last.pt")
    return run_dir
