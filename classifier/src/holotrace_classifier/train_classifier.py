import time
from dataclasses import asdict
from pathlib import Path

import torch
from torch import nn
from torch.utils.data import DataLoader

from .config import ClassifierConfig, config_to_json
from .data import CropDataset, balanced_sampler, read_crops_meta
from .labels import LABEL_SET_VERSION, LABELS
from .metrics import classification_report, confusion_matrix
from .models import build_classifier
from .preprocess import PREPROCESS_VERSION
from .utils import (
    JsonlLogger,
    Progress,
    make_run_dir,
    param_groups,
    pick_device,
    seed_everything,
    warmup_cosine,
    write_json_atomic,
)


@torch.inference_mode()
def evaluate_classifier(model: nn.Module, loader: DataLoader, device: torch.device) -> dict:
    model.eval()
    criterion = nn.CrossEntropyLoss(reduction="sum")
    loss, preds, targets = 0.0, [], []
    for x, y in loader:
        x = x.to(device, non_blocking=True, memory_format=torch.channels_last)
        y = y.to(device, non_blocking=True)
        logits = model(x)
        loss += criterion(logits, y).item()
        preds.append(logits.argmax(1).cpu())
        targets.append(y.cpu())
    preds_t, targets_t = torch.cat(preds), torch.cat(targets)
    cm = confusion_matrix(preds_t, targets_t, len(LABELS))
    return {"loss": loss / len(targets_t), **classification_report(cm, LABELS), "confusion": cm.tolist()}


BUDGET_WARMUP_STEPS = 20  # skipped when timing, so DataLoader worker startup does not skew the estimate
BUDGET_TIMED_STEPS = 200


def _budgeted_epochs(
    budget_s: float, elapsed_s: float, step: int, per_step_s: float, steps: int, val_size: int, batch: int, cap: int
) -> int:
    """Epochs that fit the remaining budget, given measured seconds per training step.

    Validation is forward-only over the val set; estimate it at a third of the per-sample training cost.
    """
    eval_s = val_size / batch * per_step_s / 3
    remaining_s = budget_s - elapsed_s + step * per_step_s  # epoch 1 is counted in full below
    return max(1, min(cap, int(remaining_s / (steps * per_step_s + eval_s))))


def train_classifier(config: ClassifierConfig) -> Path:
    seed_everything(config.seed)
    device = pick_device()
    if config.threads:
        torch.set_num_threads(config.threads)
    started = time.monotonic()
    meta = read_crops_meta(config.data.root)
    if meta["preprocess_version"] != PREPROCESS_VERSION or meta["label_set_version"] != LABEL_SET_VERSION:
        raise ValueError(f"crops in {config.data.root} were built with different preprocessing or labels; re-export")

    data = config.data
    train_set = CropDataset(data.root / "train", data.input_size, augment=True, rotate90=data.rotate90)
    val_set = CropDataset(data.root / "val", data.input_size, augment=False)
    sampler = balanced_sampler(train_set.targets, len(LABELS)) if data.balance_classes else None
    loader_args = {
        "batch_size": data.batch_size,
        "num_workers": data.num_workers,
        "pin_memory": device.type == "cuda",
        "persistent_workers": data.num_workers > 0,
    }
    train_loader = DataLoader(train_set, sampler=sampler, shuffle=sampler is None, drop_last=True, **loader_args)
    val_loader = DataLoader(val_set, shuffle=False, **loader_args)

    # channels_last lets oneDNN pick its fastest convolution kernels on CPU; weights and checkpoints are unaffected
    model = build_classifier(config.model, len(LABELS)).to(device, memory_format=torch.channels_last)
    optim = config.optim
    optimizer = torch.optim.AdamW(param_groups(model, optim.weight_decay), lr=optim.lr)
    steps = len(train_loader)
    scheduler = warmup_cosine(optimizer, optim.epochs * steps, int(optim.warmup_epochs * steps))
    criterion = nn.CrossEntropyLoss(label_smoothing=optim.label_smoothing)
    use_amp = optim.amp and device.type == "cuda"
    scaler = torch.amp.GradScaler("cuda", enabled=use_amp)

    run_dir = make_run_dir(config.output_dir, config.run_name)
    (run_dir / "config.json").write_text(config_to_json(config), encoding="utf-8")
    logger = JsonlLogger(run_dir / "metrics.jsonl")
    progress = Progress(run_dir, optim.epochs, steps)
    print(f"device={device} train={len(train_set)} val={len(val_set)} run_dir={run_dir}", flush=True)

    def checkpoint(epoch: int, metrics: dict) -> dict:
        return {
            "kind": "classifier",
            "model_version": f"{config.model.arch}-{run_dir.name}",
            "model_config": asdict(config.model),
            "labels": list(LABELS),
            "label_set_version": LABEL_SET_VERSION,
            "preprocess_version": PREPROCESS_VERSION,
            "input_size": data.input_size,
            "context_pad": meta["context_pad"],
            "crop_max_side": meta["crop_max_side"],
            "epoch": epoch,
            "metrics": {k: v for k, v in metrics.items() if k != "confusion"},
            "state_dict": model.state_dict(),
        }

    budget_s = optim.time_budget_hours * 3600
    epochs, epoch, best, stale = optim.epochs, 0, -1.0, 0
    timed_from = None
    while epoch < epochs:
        epoch += 1
        model.train()
        running_loss = torch.zeros((), device=device)
        correct = torch.zeros((), device=device)
        seen = 0
        for step, (x, y) in enumerate(train_loader, 1):
            progress.update("train", epoch, step)
            if budget_s and epoch == 1:
                if step == BUDGET_WARMUP_STEPS:
                    timed_from = time.monotonic()
                elif step == BUDGET_WARMUP_STEPS + BUDGET_TIMED_STEPS or (timed_from and step == steps):
                    per_step = (time.monotonic() - timed_from) / (step - BUDGET_WARMUP_STEPS)
                    epochs = _budgeted_epochs(
                        budget_s,
                        time.monotonic() - started,
                        step,
                        per_step,
                        steps,
                        len(val_set),
                        data.batch_size,
                        optim.epochs,
                    )
                    scheduler.total_steps = epochs * steps
                    progress.base["epochs"] = epochs
                    print(
                        f"time budget {optim.time_budget_hours:g} h: {per_step:.3f} s/step, "
                        f"{steps * per_step / 60:.1f} min/epoch -> {epochs} epochs",
                        flush=True,
                    )
                    timed_from = None
            x = x.to(device, non_blocking=True, memory_format=torch.channels_last)
            y = y.to(device, non_blocking=True)
            with torch.autocast(device.type, enabled=use_amp):
                logits = model(x)
                loss = criterion(logits, y)
            optimizer.zero_grad(set_to_none=True)
            scaler.scale(loss).backward()
            scaler.unscale_(optimizer)
            nn.utils.clip_grad_norm_(model.parameters(), optim.grad_clip)
            scaler.step(optimizer)
            scaler.update()
            scheduler.step()
            running_loss += loss.detach() * len(y)
            correct += (logits.argmax(1) == y).sum()
            seen += len(y)

        progress.update("eval", epoch, steps, force=True)
        val = evaluate_classifier(model, val_loader, device)
        logger.log(
            {
                "epoch": epoch,
                "lr": scheduler.get_last_lr()[0],
                "train_loss": (running_loss / seen).item(),
                "train_acc": (correct / seen).item(),
                "val_loss": val["loss"],
                "val_acc": val["accuracy"],
                "val_macro_f1": val["macro_f1"],
            }
        )
        if val["macro_f1"] > best:
            best, stale = val["macro_f1"], 0
            torch.save(checkpoint(epoch, val), run_dir / "best.pt")
            write_json_atomic(run_dir / "best_metrics.json", {"epoch": epoch} | val)
        else:
            stale += 1
            if stale >= optim.early_stop_patience:
                print(f"early stop: no val macro F1 improvement for {stale} epochs", flush=True)
                break

    torch.save(checkpoint(epoch, val), run_dir / "last.pt")
    progress.update("stopped" if epoch < epochs else "done", epoch, steps, force=True)
    return run_dir
