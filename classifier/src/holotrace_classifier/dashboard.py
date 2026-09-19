"""Read-only training dashboard over a runs directory. Standard library only, so it runs beside training.

GET /                         dashboard page
GET /api/runs                 run summaries (newest first)
GET /api/runs/<kind>/<name>   config, per-epoch metrics, progress, best validation metrics
GET /api/system               load, memory, disk, and the tail of any --log files

It exposes training metrics and logs only, never datasets or user content. Bind it to localhost or a Tailscale IP.
"""

import json
import os
import shutil
import time
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

KINDS = ("classifier", "detector")
PRIMARY = {"classifier": "val_macro_f1", "detector": "val_map"}
# No progress update for this long while training means the process is probably gone (evaluation can be slow on CPU)
STALE_SECONDS = 15 * 60
PAGE = Path(__file__).with_name("dashboard.html")


def _read_json(path: Path) -> dict | None:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def _read_records(path: Path) -> list[dict]:
    if not path.exists():
        return []
    records = []
    for line in path.read_text(encoding="utf-8").splitlines():
        try:
            records.append(json.loads(line))
        except ValueError:
            continue  # a line being written right now
    return records


def _tail(path: Path, lines: int = 60, max_bytes: int = 32_768) -> list[str]:
    try:
        with path.open("rb") as fh:
            fh.seek(max(0, path.stat().st_size - max_bytes))
            text = fh.read().decode("utf-8", errors="replace")
    except OSError:
        return []
    # Collapse carriage-return progress bars to their final state
    return [line.rsplit("\r", 1)[-1] for line in text.splitlines()[-lines:]]


def _status(run_dir: Path, progress: dict | None) -> str:
    if progress is None:
        return "finished" if (run_dir / "last.pt").exists() else "starting"
    if progress["phase"] in ("done", "stopped"):
        return progress["phase"]
    return "stalled" if time.time() - progress["time"] > STALE_SECONDS else progress["phase"]


def run_summary(kind: str, run_dir: Path) -> dict:
    records = _read_records(run_dir / "metrics.jsonl")
    progress = _read_json(run_dir / "progress.json")
    key = PRIMARY[kind]
    scored = [r for r in records if r.get(key) is not None]
    best = max(scored, key=lambda r: r[key]) if scored else None
    return {
        "kind": kind,
        "name": run_dir.name,
        "status": _status(run_dir, progress),
        "epochs_done": len(records),
        "epochs": progress["epochs"] if progress else None,
        "metric": key,
        "best": best[key] if best else None,
        "best_epoch": best["epoch"] if best else None,
        "updated": max((p.stat().st_mtime for p in run_dir.iterdir()), default=run_dir.stat().st_mtime),
    }


def run_detail(kind: str, run_dir: Path) -> dict:
    return {
        "summary": run_summary(kind, run_dir),
        "config": _read_json(run_dir / "config.json"),
        "records": _read_records(run_dir / "metrics.jsonl"),
        "progress": _read_json(run_dir / "progress.json"),
        "best": _read_json(run_dir / "best_metrics.json"),
    }


def system_stats(runs_root: Path, logs: list[Path]) -> dict:
    stats: dict = {"cpus": os.cpu_count(), "time": time.time()}
    if hasattr(os, "getloadavg"):
        stats["load"] = os.getloadavg()
    meminfo = Path("/proc/meminfo")
    if meminfo.exists():
        fields = dict(line.split(":", 1) for line in meminfo.read_text().splitlines() if ":" in line)
        total = int(fields["MemTotal"].split()[0]) * 1024
        stats["memory"] = {"total": total, "used": total - int(fields["MemAvailable"].split()[0]) * 1024}
    usage = shutil.disk_usage(runs_root if runs_root.exists() else Path.cwd())
    stats["disk"] = {"total": usage.total, "used": usage.used}
    stats["logs"] = [{"path": str(path), "lines": _tail(path)} for path in logs]
    return stats


def make_handler(runs_root: Path, logs: list[Path]) -> type[BaseHTTPRequestHandler]:
    class Handler(BaseHTTPRequestHandler):
        def _send(self, status: HTTPStatus, body: bytes, content_type: str) -> None:
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.end_headers()
            self.wfile.write(body)

        def _json(self, data: object, status: HTTPStatus = HTTPStatus.OK) -> None:
            self._send(status, json.dumps(data).encode(), "application/json")

        def do_GET(self) -> None:  # noqa: N802 (http.server naming)
            path = urlsplit(self.path).path
            if path == "/":
                self._send(HTTPStatus.OK, PAGE.read_bytes(), "text/html; charset=utf-8")
            elif path == "/api/runs":
                runs = [
                    run_summary(kind, run_dir)
                    for kind in KINDS
                    if (runs_root / kind).is_dir()
                    for run_dir in (runs_root / kind).iterdir()
                    if run_dir.is_dir()
                ]
                self._json(sorted(runs, key=lambda r: r["updated"], reverse=True))
            elif path.startswith("/api/runs/"):
                parts = [unquote(p) for p in path.removeprefix("/api/runs/").split("/")]
                # Only names that exist as run directories are accepted, which rules out path traversal
                if len(parts) != 2 or parts[0] not in KINDS or not (runs_root / parts[0]).is_dir():
                    self._json({"error": "not found"}, HTTPStatus.NOT_FOUND)
                    return
                names = {p.name for p in (runs_root / parts[0]).iterdir() if p.is_dir()}
                if parts[1] not in names:
                    self._json({"error": "not found"}, HTTPStatus.NOT_FOUND)
                    return
                self._json(run_detail(parts[0], runs_root / parts[0] / parts[1]))
            elif path == "/api/system":
                self._json(system_stats(runs_root, logs))
            else:
                self._json({"error": "not found"}, HTTPStatus.NOT_FOUND)

        def log_message(self, format: str, *args: object) -> None:
            pass

    return Handler


def serve_dashboard(runs_root: Path, host: str, port: int, logs: list[Path]) -> None:
    server = ThreadingHTTPServer((host, port), make_handler(runs_root, logs))
    print(f"dashboard on http://{host}:{port} (runs: {runs_root.resolve()})", flush=True)
    server.serve_forever()
