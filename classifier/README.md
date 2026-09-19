# Holotrace classifier

PyTorch models for the external recognition stage described in [`reference/system-pipeline.md`](../reference/system-pipeline.md). This package covers symbol recognition only. Wires, pins, and connectivity, plus normalization into Circuit IR, are still future work.

## Where it fits

```text
client (Tauri)                              this package
--------------                              ------------
capture -> local OpenCV pass -> proposals ->  normalize_page
                                              |-- crop classifier: label each proposal (or "background")
                                              '-- detector: find symbols on the full page
                                              -> RecognitionResult (raw, not yet Circuit IR)
```

There are two models because the local OpenCV pass will be imperfect:

- **Crop classifier** (`resnet_tiny` or `mobilenet_v3_small`): cheap. It labels each region the client proposes and uses `background` to reject regions that are not symbols.
- **Detector** (Faster R-CNN): more expensive. It finds symbols on the whole page, including ones the client missed.

Both results go into `RecognitionResult` separately. Fusing them, along with wire tracing and building the netlist, belongs to the normalization stage downstream.

## Layout

```text
configs/                 training configs (TOML, unknown keys rejected)
src/holotrace_classifier/
  labels.py              label set; index order is part of every checkpoint
  preprocess.py          shared train/inference preprocessing, PREPROCESS_VERSION
  augment.py             crop and page augmentation (boxes transformed with pixels)
  manifest.py            Holotrace annotation format (JSONL, one page per line)
  cghd.py                CGHD Pascal VOC -> manifests, split by drafter
  crops.py               manifests -> classifier crops (+ jitter, + background)
  data.py                PyTorch datasets, class-balanced sampler
  models/classifier.py   ResNetTiny (from scratch), MobileNetV3 (fine-tune)
  models/detector.py     Faster R-CNN with new head and smaller anchors
  metrics.py             confusion matrix, macro F1, VOC-style AP
  train_classifier.py    AdamW, warmup + cosine, label smoothing, early stopping
  train_detector.py      SGD + Nesterov, warmup + cosine, mAP@0.5 model selection
  contracts.py           PROVISIONAL request/response models (pydantic)
  inference.py           checkpoint loading with version checks, Recognizer
  registry.py            promote runs into a versioned model registry
  service.py             Flask recognition service over the registry
  cli.py                 `holotrace-ml` entry point
```

## Setup

Requires [uv](https://docs.astral.sh/uv/) and Python 3.13+.

```sh
cd classifier
uv sync
uv run holotrace-ml --help
```

`pyproject.toml` installs CPU PyTorch wheels on Linux and Windows because the training server has no GPU. To train on a CUDA machine, change the `pytorch-cpu` index URL to a CUDA one (for example `https://download.pytorch.org/whl/cu128`) and run `uv sync` again. AMP turns on automatically when CUDA is available.

## Data

### CGHD (public)

[CGHD](https://github.com/DFKI/cghd) has about 3,000 photos of hand-drawn circuits from 30 drafters, with Pascal VOC bounding boxes. `labels.py` uses its class names. It is licensed CC-BY-4.0 ([Zenodo record](https://zenodo.org/records/14042961)), so any model trained on it must credit the dataset wherever that model is distributed or documented.

The [Hugging Face mirror](https://huggingface.co/datasets/lowercaseonly/cghd) stores it as individual files, which downloads much faster than the single Zenodo zip. Images and annotations are enough:

```sh
uvx --from huggingface_hub hf download lowercaseonly/cghd --repo-type dataset --local-dir ~/datasets/cghd   --max-workers 16 --include "drafter_*/images/*" --include "drafter_*/annotations/*"
uv run holotrace-ml import-cghd --root ~/datasets/cghd --out data/manifests
```

Splits are made per drafter, with 3 drafters each for val and test by default. A split made per image would leak each person's handwriting into evaluation and overstate accuracy. The import writes `data/manifests/import_report.json`. It lists kept label counts and the CGHD labels that were skipped because they are not in `labels.py`.

### Own data

Write the same JSONL format as `manifest.py`. Put each annotation set in its own `group` (a person or session), so splits by group stay honest.

## Workflow

```sh
# 1. classifier crops: one per symbol, plus jittered copies and background regions
uv run holotrace-ml export-crops --manifests data/manifests --out data/crops

# 2. look at what the model actually sees, with and without augmentation
uv run holotrace-ml preview-crops --split train --augment --out previews/train_aug.png

# 3. train
uv run holotrace-ml train-classifier --config configs/classifier.toml
uv run holotrace-ml train-detector --config configs/detector.toml

# 4. evaluate on held-out drafters
uv run holotrace-ml eval-classifier --checkpoint runs/classifier/<run>/best.pt --split test --output runs/eval/cls.json
uv run holotrace-ml eval-detector --checkpoint runs/detector/<run>/best.pt --output runs/eval/det.json

# 5. end to end on one image (request JSON optional; without it only the detector runs)
uv run holotrace-ml recognize --image photo.jpg --request request.json \
  --classifier runs/classifier/<run>/best.pt --detector runs/detector/<run>/best.pt
```

Each run directory contains `config.json`, `metrics.jsonl` (one line per epoch), `best.pt`, and `last.pt`. `data/`, `runs/`, `previews/`, and weight files are git-ignored.

## Training on the remote server

The training server is a CPU-only Linux VM reachable over Tailscale. Keep credentials out of this repository; use SSH keys and never commit hostnames with passwords.

The repository is private and the server has no GitHub credentials, so code is sent as a git bundle:

```sh
# on your machine
git bundle create holotrace.bundle feat/classifier
scp holotrace.bundle <user>@<server>:

# on the server (first time: git clone -b feat/classifier ~/holotrace.bundle ~/holotrace)
cd ~/holotrace && git pull ~/holotrace.bundle feat/classifier
cd classifier && uv sync
uv run holotrace-ml import-cghd --root ~/datasets/cghd --out data/manifests
uv run holotrace-ml export-crops
mkdir -p runs && tmux new -d -s train "uv run holotrace-ml train-classifier 2>&1 | tee runs/classifier.log"
tail -f runs/classifier.log
```

Set `num_workers` in the configs to about the number of cores minus two. On CPU, expect the classifier to take minutes per epoch and the MobileNet detector to take much longer. Train and tune the classifier first.

## Serving trained models

Training and serving are connected by a model registry (`models/`, git-ignored). A trained model is only served once it is promoted:

```sh
# on the training server, after reviewing the eval report
uv run holotrace-ml promote --run runs/classifier/<run>
uv run holotrace-ml promote --run runs/detector/<run>
```

`promote` copies the checkpoint into `models/<kind>/<model_version>/` with a `card.json` (source run, metrics, label and preprocessing versions, sha256), then updates `models/<kind>/CURRENT`. It refuses to replace the current model with one that scores lower on validation unless `--force` is given.

The registry is self-contained, so deploying to the separate serving host is a copy followed by a reload:

```sh
rsync -a models/ <serving-host>:holotrace/classifier/models/
curl -X POST -H "Authorization: Bearer $HOLOTRACE_ML_API_KEY" http://<serving-host>:8000/v0/admin/reload
```

On the serving host:

```sh
uv sync --extra serve
cp .env.example .env   # set HOLOTRACE_ML_API_KEY, then export it into the environment
uv run holotrace-ml serve --registry models --host <tailscale-ip> --port 8000
```

| Route | Auth | Purpose |
| --- | --- | --- |
| `GET /health` | none | liveness |
| `GET /v0/models` | key | versions currently loaded |
| `POST /v0/recognize` | key | multipart `image` file + `request` (RecognitionRequest JSON) -> RecognitionResult |
| `POST /v0/admin/reload` | key | re-read `CURRENT` and swap models without a restart |

The service verifies each checkpoint against its card's sha256 before loading it. It returns 400 for an invalid request, 422 for an image it cannot decode or whose size disagrees with the request, and 413 for uploads over `--max-upload-mb`. Request bodies are not logged. The API key is server-side only: the Tauri client must reach this service through a backend that holds the key, never with the key embedded in the app. Bind to the Tailscale IP, not `0.0.0.0`.

## Design notes

**Preprocessing parity.** `preprocess.py` is the only place that turns pixels into model input, and training and inference both call it. Each checkpoint records `PREPROCESS_VERSION`, and `load_checkpoint` refuses a mismatch. Bump the version on any change that alters the output.

**Page normalization.** Pages are downscaled to 1600 px on the long side so stroke width in pixels is roughly stable. Illumination is flattened by dividing by a morphological-closing estimate of the paper, which removes shadows and paper tint before either model sees the image.

**Classifier input.** Crops are an ink map (ink 1, paper 0), stretched by the 99.5th percentile with a floor so empty crops stay empty, then letterboxed to 96 px so aspect ratio is preserved. Context padding around the box (`--context-pad`) keeps nearby wire stubs, which help separate look-alike symbols. The padding value is stored in `crops_meta.json` and the checkpoint so inference crops the same way.

**Imbalance.** CGHD is dominated by `text` and `junction`. The sampler weights samples by `1/sqrt(count)`, and model selection uses macro F1 rather than accuracy, so rare symbols count.

**Robustness to client proposals.** Jittered crops (shifted and rescaled by up to 15%) and a `background` class train the classifier on the loose and wrong boxes a local OpenCV pass will produce.

**Detector.** COCO-pretrained Faster R-CNN with a new 52-class head. Anchor sizes are halved (`anchor_scale`) because junctions and crossovers are much smaller than COCO objects. Evaluation uses a 0.05 score floor so AP covers the whole precision/recall curve, while serving uses `score_threshold`.

## Contract status

`contracts.py` is a placeholder until the client input reference and the local OpenCV label set are defined. When they are:

1. Align `RecognitionRequest` and `RegionProposal` with the client reference and bump `SCHEMA_VERSION`.
2. Map the local OpenCV labels to `labels.py` (or record them as hints only).
3. Mirror the contract as TypeScript types on the client.

## Next steps

- Calibrate classifier confidences (temperature scaling on val) before the client relies on thresholds.
- Wire and junction extraction (segmentation or line tracing) to build nets.
- Client-facing auth: a backend that holds the service key and authenticates users.
- ONNX or TorchScript export for serving.
- Cache decoded, resized pages to speed up detector epochs on CPU.
