# Recognition API on the training server

This directory contains a systemd user service for running the recognition API from the same checkout and model
registry used for training. The API process can start before a model is available. Its liveness endpoint returns 200,
while readiness returns 503 until a checkpoint is promoted and loaded.

## Install once

Run these commands as the unprivileged account that owns the Holotrace checkout:

```sh
cd ~/holotrace/classifier
uv sync --extra serve

install -d ~/.config/holotrace ~/.config/systemd/user
install -m 600 .env.example ~/.config/holotrace/ml.env
install -m 644 deploy/holotrace-ml.service ~/.config/systemd/user/holotrace-ml.service
```

Set `HOLOTRACE_ML_API_KEY` in `~/.config/holotrace/ml.env` to a random value of at least 32 characters. Keep
`HOLOTRACE_ML_HOST=127.0.0.1` when a backend or reverse proxy on this server calls the API. To call it directly from
another device on the tailnet, set the host to this server's Tailscale IP. Do not bind the service to `0.0.0.0`.

Enable the service:

```sh
systemctl --user daemon-reload
systemctl --user enable --now holotrace-ml
loginctl enable-linger "$USER"
```

`loginctl enable-linger` may require an administrator, depending on the server configuration. It keeps the user
service running after logout.

## Promote the finished run

Review the held-out evaluation before promotion. Then promote the best checkpoint and tell the running service to
load it:

```sh
cd ~/holotrace/classifier
uv run holotrace-ml promote --run runs/classifier/<run>

set -a
. ~/.config/holotrace/ml.env
set +a
curl --fail-with-body -X POST \
  -H "Authorization: Bearer $HOLOTRACE_ML_API_KEY" \
  "http://$HOLOTRACE_ML_HOST:$HOLOTRACE_ML_PORT/v0/admin/reload"
```

The reload builds the replacement recognizer before swapping it into service. If loading fails, an already loaded
model continues serving requests.

## Operations

```sh
curl --fail "http://$HOLOTRACE_ML_HOST:$HOLOTRACE_ML_PORT/health"
curl --fail "http://$HOLOTRACE_ML_HOST:$HOLOTRACE_ML_PORT/health/ready"
systemctl --user status holotrace-ml
journalctl --user -u holotrace-ml -f
```

`/health` checks the HTTP process. `/health/ready` returns 200 only after at least one promoted model is loaded.

The service serializes inference because CPU inference uses the whole machine. Avoid running recognition traffic
during training unless slower epochs are acceptable.
