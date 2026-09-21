# Bundled classifier weights

This directory is a self-contained model registry copied from the Holotrace training server. A fresh checkout can run the recognition service without access to that server or to the training dataset.

Two trained crop classifiers are included:

| Version | Width | Validation macro F1 | Checkpoint SHA-256 |
| --- | ---: | ---: | --- |
| `resnet_tiny-20260919-174324` | 32 | 0.8230 | `96019786ca87c835ce104d7a0b4070fc4fa119923111728d42bed48e186e48cc` |
| `resnet_tiny-resnet_w48_cpu24` | 48 | 0.8022 | `91d51cfc715aa399feebe1281895361adfcdeaa25fabc057e1f8a863a7930904` |

The width-32 model is selected in `classifier/CURRENT` because it has the higher held-out macro F1. Each version contains the original best checkpoint, training configuration, complete held-out metrics, and a registry card used for integrity verification.

## Start the API on a new machine

Install [uv](https://docs.astral.sh/uv/), clone the repository, and run these commands from `classifier/`:

```sh
uv sync --extra serve
export HOLOTRACE_ML_API_KEY="replace-with-a-random-value-of-at-least-32-characters"
uv run holotrace-ml serve --registry weights --host 127.0.0.1 --port 8000
```

In PowerShell, set the key with:

```powershell
$env:HOLOTRACE_ML_API_KEY = "replace-with-a-random-value-of-at-least-32-characters"
uv run holotrace-ml serve --registry weights --host 127.0.0.1 --port 8000
```

Check that the model loaded at `http://127.0.0.1:8000/health/ready`. Keep the service on localhost unless it is intentionally exposed over a private network or placed behind an authenticated backend.

To select the width-48 checkpoint instead, replace the single line in `classifier/CURRENT` with `resnet_tiny-resnet_w48_cpu24` before starting or reloading the service.

For one-off local inference without starting the API:

```sh
uv run holotrace-ml recognize --image photo.jpg --request request.json \
  --classifier weights/classifier/resnet_tiny-20260919-174324/model.pt
```
