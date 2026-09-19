import argparse
import json
from pathlib import Path

import numpy as np


def _import_cghd(args: argparse.Namespace) -> None:
    from .cghd import import_cghd

    report = import_cghd(
        args.root, args.out, val_drafters=args.val_drafters, test_drafters=args.test_drafters, seed=args.seed
    )
    (args.out / "import_report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))


def _export_crops(args: argparse.Namespace) -> None:
    from .crops import export_crops

    meta = export_crops(
        args.manifests,
        args.out,
        context_pad=args.context_pad,
        jitter_copies=args.jitter_copies,
        background_per_image=args.background_per_image,
        seed=args.seed,
    )
    print(json.dumps(meta["counts"], indent=2))


def _train_classifier(args: argparse.Namespace) -> None:
    from .config import ClassifierConfig, load_config
    from .train_classifier import train_classifier

    print(f"run: {train_classifier(load_config(ClassifierConfig, args.config))}")


def _train_detector(args: argparse.Namespace) -> None:
    from .config import DetectorConfig, load_config
    from .train_detector import train_detector

    print(f"run: {train_detector(load_config(DetectorConfig, args.config))}")


def _eval_classifier(args: argparse.Namespace) -> None:
    from torch.utils.data import DataLoader

    from .data import CropDataset
    from .inference import load_checkpoint
    from .train_classifier import evaluate_classifier
    from .utils import pick_device

    device = pick_device()
    model, meta = load_checkpoint(args.checkpoint, "classifier", device)
    dataset = CropDataset(args.crops / args.split, meta["input_size"], augment=False)
    report = evaluate_classifier(model, DataLoader(dataset, batch_size=256, num_workers=args.num_workers), device)
    _emit(report, args.output, ("loss", "accuracy", "macro_f1"))


def _eval_detector(args: argparse.Namespace) -> None:
    from torch.utils.data import DataLoader

    from .data import PageDetectionDataset, collate_detection
    from .inference import load_checkpoint
    from .manifest import read_manifest
    from .train_detector import evaluate_detector
    from .utils import pick_device

    device = pick_device()
    model, _ = load_checkpoint(args.checkpoint, "detector", device)
    dataset = PageDetectionDataset(read_manifest(args.manifest), augment=False)
    loader = DataLoader(dataset, batch_size=2, num_workers=args.num_workers, collate_fn=collate_detection)
    _emit(evaluate_detector(model, loader, device, args.iou), args.output, ("map", "iou_threshold"))


def _emit(report: dict, output: Path | None, summary_keys: tuple[str, ...]) -> None:
    print(json.dumps({k: report[k] for k in summary_keys}, indent=2))
    if output:
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(report, indent=2), encoding="utf-8")
        print(f"full report: {output}")


def _recognize(args: argparse.Namespace) -> None:
    from .contracts import SCHEMA_VERSION, RecognitionRequest
    from .inference import Recognizer
    from .preprocess import decode_grayscale

    image = args.image.read_bytes()
    if args.request:
        request = RecognitionRequest.model_validate_json(args.request.read_text(encoding="utf-8"))
    else:
        h, w = decode_grayscale(image).shape
        request = RecognitionRequest(
            schema_version=SCHEMA_VERSION, client_preprocess_version="none", image_width=w, image_height=h
        )
    recognizer = Recognizer(args.classifier, args.detector)
    print(recognizer.recognize(image, request, top_k=args.top_k).model_dump_json(indent=2))


def _preview_crops(args: argparse.Namespace) -> None:
    import torch
    from torchvision.utils import make_grid

    from .data import CropDataset
    from .labels import LABELS
    from .preprocess import write_image

    dataset = CropDataset(args.crops / args.split, args.input_size, augment=args.augment)
    picks = torch.randperm(len(dataset), generator=torch.Generator().manual_seed(args.seed))[: args.count]
    items = [dataset[i] for i in picks.tolist()]
    grid = make_grid(torch.stack([x for x, _ in items]), nrow=8, padding=2, pad_value=0.5)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    write_image(args.out, (grid[0].numpy() * 255).astype(np.uint8))
    for row in range(0, len(items), 8):
        print(" | ".join(LABELS[t] for _, t in items[row : row + 8]))
    print(f"wrote {args.out}")


def _promote(args: argparse.Namespace) -> None:
    from .registry import promote

    card = promote(args.run, args.registry, checkpoint_name=args.checkpoint, force=args.force)
    summary = {k: v for k, v in card["metrics"].items() if not isinstance(v, (dict, list))}
    print(f"{card['kind']} CURRENT -> {card['model_version']} {json.dumps(summary)}")


def main() -> None:
    parser = argparse.ArgumentParser(prog="holotrace-ml", description="Holotrace symbol recognition")
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("import-cghd", help="convert the CGHD dataset into train/val/test manifests")
    p.add_argument("--root", type=Path, required=True, help="CGHD root containing drafter_* directories")
    p.add_argument("--out", type=Path, default=Path("data/manifests"))
    p.add_argument("--val-drafters", type=int, default=3)
    p.add_argument("--test-drafters", type=int, default=3)
    p.add_argument("--seed", type=int, default=0)
    p.set_defaults(func=_import_cghd)

    p = sub.add_parser("export-crops", help="cut classifier crops (with jitter and background) from manifests")
    p.add_argument("--manifests", type=Path, default=Path("data/manifests"))
    p.add_argument("--out", type=Path, default=Path("data/crops"))
    p.add_argument("--context-pad", type=float, default=0.15)
    p.add_argument("--jitter-copies", type=int, default=1)
    p.add_argument("--background-per-image", type=int, default=8)
    p.add_argument("--seed", type=int, default=0)
    p.set_defaults(func=_export_crops)

    p = sub.add_parser("train-classifier")
    p.add_argument("--config", type=Path, default=Path("configs/classifier.toml"))
    p.set_defaults(func=_train_classifier)

    p = sub.add_parser("train-detector")
    p.add_argument("--config", type=Path, default=Path("configs/detector.toml"))
    p.set_defaults(func=_train_detector)

    p = sub.add_parser("eval-classifier")
    p.add_argument("--checkpoint", type=Path, required=True)
    p.add_argument("--crops", type=Path, default=Path("data/crops"))
    p.add_argument("--split", default="test")
    p.add_argument("--num-workers", type=int, default=4)
    p.add_argument("--output", type=Path)
    p.set_defaults(func=_eval_classifier)

    p = sub.add_parser("eval-detector")
    p.add_argument("--checkpoint", type=Path, required=True)
    p.add_argument("--manifest", type=Path, default=Path("data/manifests/test.jsonl"))
    p.add_argument("--iou", type=float, default=0.5)
    p.add_argument("--num-workers", type=int, default=4)
    p.add_argument("--output", type=Path)
    p.set_defaults(func=_eval_detector)

    p = sub.add_parser("recognize", help="run the models on one image and print a RecognitionResult")
    p.add_argument("--image", type=Path, required=True)
    p.add_argument("--request", type=Path, help="RecognitionRequest JSON with region proposals")
    p.add_argument("--classifier", type=Path)
    p.add_argument("--detector", type=Path)
    p.add_argument("--top-k", type=int, default=3)
    p.set_defaults(func=_recognize)

    p = sub.add_parser("preview-crops", help="write a grid of model inputs to check preprocessing/augmentation")
    p.add_argument("--crops", type=Path, default=Path("data/crops"))
    p.add_argument("--split", default="train")
    p.add_argument("--input-size", type=int, default=96)
    p.add_argument("--count", type=int, default=64)
    p.add_argument("--augment", action="store_true")
    p.add_argument("--seed", type=int, default=0)
    p.add_argument("--out", type=Path, default=Path("previews/crops.png"))
    p.set_defaults(func=_preview_crops)

    p = sub.add_parser("promote", help="copy a run's checkpoint into the model registry and make it current")
    p.add_argument("--run", type=Path, required=True, help="training run directory, e.g. runs/classifier/<run>")
    p.add_argument("--checkpoint", default="best.pt")
    p.add_argument("--registry", type=Path, default=Path("models"))
    p.add_argument("--force", action="store_true", help="promote even if the validation score is lower")
    p.set_defaults(func=_promote)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
