"""Local model registry: the hand-off point between training runs and the recognition service.

registry/
  classifier/
    CURRENT                 version name of the model the service should load
    <model_version>/
      model.pt              checkpoint copied from the training run
      card.json             provenance, versions, metrics, sha256
      config.json           training config of the source run
  detector/ ...

The directory is self-contained, so it can be copied to a separate serving host as-is.
"""

import hashlib
import json
import os
import shutil
from datetime import UTC, datetime
from pathlib import Path

import torch

KINDS = ("classifier", "detector")
PRIMARY_METRIC = {"classifier": "macro_f1", "detector": "map"}


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_card(registry: Path, kind: str, version: str) -> dict:
    return json.loads((registry / kind / version / "card.json").read_text(encoding="utf-8"))


def current_version(registry: Path, kind: str) -> str | None:
    pointer = registry / kind / "CURRENT"
    return pointer.read_text(encoding="utf-8").strip() if pointer.exists() else None


def current_checkpoint(registry: Path, kind: str) -> Path | None:
    version = current_version(registry, kind)
    if version is None:
        return None
    path = registry / kind / version / "model.pt"
    card = read_card(registry, kind, version)
    if _sha256(path) != card["sha256"]:
        raise ValueError(f"{path} does not match the sha256 in its card; the copy is incomplete or modified")
    return path


def promote(run_dir: Path, registry: Path, *, checkpoint_name: str = "best.pt", force: bool = False) -> dict:
    """Copy a run's checkpoint into the registry and point CURRENT at it.

    Refuses to replace a current model with a lower validation score unless forced. Scores are only comparable
    when both runs used the same validation split.
    """
    source = run_dir / checkpoint_name
    ckpt = torch.load(source, map_location="cpu", weights_only=True)
    kind, version = ckpt["kind"], ckpt["model_version"]
    if kind not in KINDS:
        raise ValueError(f"unknown checkpoint kind {kind!r}")

    metric = PRIMARY_METRIC[kind]
    score = ckpt["metrics"].get(metric)
    active = current_version(registry, kind)
    if active and active != version and not force:
        active_score = read_card(registry, kind, active)["metrics"].get(metric)
        if active_score is not None and (score is None or score < active_score):
            raise ValueError(
                f"{version} {metric}={score} is below current {active} {metric}={active_score}; use --force"
            )

    target = registry / kind / version
    if not target.exists():
        target.mkdir(parents=True)
        shutil.copy2(source, target / "model.pt")
        if (run_dir / "config.json").exists():
            shutil.copy2(run_dir / "config.json", target / "config.json")
        card = {
            "kind": kind,
            "model_version": version,
            "source_run": run_dir.name,
            "source_checkpoint": checkpoint_name,
            "epoch": ckpt["epoch"],
            "label_set_version": ckpt["label_set_version"],
            "preprocess_version": ckpt["preprocess_version"],
            "metrics": ckpt["metrics"],
            "sha256": _sha256(target / "model.pt"),
            "promoted_at": datetime.now(UTC).isoformat(timespec="seconds"),
        }
        (target / "card.json").write_text(json.dumps(card, indent=2), encoding="utf-8")

    # Write-then-rename so a service reloading mid-promotion never reads a partial pointer
    pointer = registry / kind / "CURRENT"
    tmp = pointer.with_suffix(".tmp")
    tmp.write_text(version + "\n", encoding="utf-8")
    os.replace(tmp, pointer)
    return read_card(registry, kind, version)
