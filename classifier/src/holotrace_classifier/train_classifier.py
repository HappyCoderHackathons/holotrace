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
from .utils import JsonlLogger, make_run_dir, param_groups, pick_device, seed_everything, warmup_cosine


@torch.inference_mode()
def evaluate_classifier(model: nn.Module, loader: DataLoader, device: torch.device) -> dict:
    model.eval()
    criterion = nn.CrossEntropyLoss(reduction="sum")
    loss, preds, targets = 0.0, [], []
    for x, y in loader:
        x, y = x.to(device, non_blocking=True), y.to(device, non_blocking=True)
        logits = model(x)
        loss += criterion(logits, y).item()
        preds.append(logits.argmax(1).cpu())
        targets.append(y.cpu())
    preds_t, targets_t = torch.cat(preds), torch.cat(targets)
    cm = confusion_matrix(preds_t, targets_t, len(LABELS))
    return {"loss": loss / len(targets_t), **classification_report(cm, LABELS), "confusion": cm.tolist()}


def train_classifier(config: ClassifierConfig) -> Path:
    seed_everything(config.seed)
    device = pick_device()
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

    model = build_classifier(config.model, len(LABELS)).to(device)
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

    best, stale = -1.0, 0
    for epoch in range(1, optim.epochs + 1):
        model.train()
        running_loss = torch.zeros((), device=device)
        correct = torch.zeros((), device=device)
        seen = 0
        for x, y in train_loader:
            x, y = x.to(device, non_blocking=True), y.to(device, non_blocking=True)
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
        else:
            stale += 1
            if stale >= optim.early_stop_patience:
                print(f"early stop: no val macro F1 improvement for {stale} epochs", flush=True)
                break

    torch.save(checkpoint(epoch, val), run_dir / "last.pt")
    return run_dir
