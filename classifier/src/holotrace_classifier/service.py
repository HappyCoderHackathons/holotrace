"""HTTP recognition service backed by the promoted models in a registry.

POST /v0/recognize     multipart: `image` file + `request` field (RecognitionRequest JSON) -> RecognitionResult
GET  /v0/models        versions currently loaded
POST /v0/admin/reload  re-read CURRENT pointers and swap models without a restart
GET  /health           liveness, no auth
GET  /health/ready     readiness, no auth (503 until at least one model is loaded)

Every route except /health requires `Authorization: Bearer <HOLOTRACE_ML_API_KEY>`. The key is server-side only;
it must never ship in the Tauri client. Request bodies are not logged.
"""

import hmac
import threading
from pathlib import Path

from flask import Flask, Response, jsonify, request
from pydantic import ValidationError

from .contracts import RecognitionRequest, RecognitionResult
from .inference import Recognizer
from .registry import current_checkpoint


class ModelState:
    def __init__(self, registry: Path) -> None:
        self.registry = registry
        self._lock = threading.Lock()
        self.recognizer: Recognizer | None = None
        self.load_error: str | None = None
        self.reload(require_model=False)

    def reload(self, *, require_model: bool = True) -> None:
        try:
            classifier = current_checkpoint(self.registry, "classifier")
            detector = current_checkpoint(self.registry, "detector")
            if classifier is None and detector is None:
                raise RuntimeError(f"no promoted models in {self.registry}; run `holotrace-ml promote` first")
            # Load outside the lock so requests keep being served by the old models while new ones load.
            recognizer = Recognizer(classifier, detector)
        except (RuntimeError, ValueError, FileNotFoundError) as exc:
            with self._lock:
                self.load_error = str(exc)
            if require_model:
                raise
            return
        with self._lock:
            self.recognizer = recognizer
            self.load_error = None

    def versions(self) -> dict[str, str | None]:
        with self._lock:
            meta = self.recognizer
        if meta is None:
            return {"classifier": None, "detector": None}
        return {
            "classifier": meta.classifier_meta["model_version"] if meta.classifier_meta else None,
            "detector": meta.detector_meta["model_version"] if meta.detector_meta else None,
        }

    def recognize(self, image: bytes, recognition_request: RecognitionRequest) -> RecognitionResult:
        # Serialized: CPU inference already uses every core, and this keeps model swaps atomic
        with self._lock:
            if self.recognizer is None:
                raise RuntimeError("recognition service is not ready; promote a model and reload")
            return self.recognizer.recognize(image, recognition_request)

    def is_ready(self) -> bool:
        with self._lock:
            return self.recognizer is not None


def create_app(registry: Path, api_key: str, *, max_upload_mb: int = 20) -> Flask:
    if len(api_key) < 32:
        raise ValueError("API key must be at least 32 characters")
    app = Flask(__name__)
    app.config["MAX_CONTENT_LENGTH"] = max_upload_mb * 1024 * 1024
    state = ModelState(registry)
    expected = api_key.encode()

    @app.before_request
    def require_key() -> tuple[Response, int] | None:
        if request.endpoint in {"health", "ready"}:
            return None
        header = request.headers.get("Authorization", "")
        token = header.removeprefix("Bearer ").encode() if header.startswith("Bearer ") else b""
        if not hmac.compare_digest(token, expected):
            return jsonify(error="unauthorized"), 401
        return None

    @app.get("/health")
    def health() -> Response:
        return jsonify(status="ok")

    @app.get("/health/ready")
    def ready() -> Response | tuple[Response, int]:
        if state.is_ready():
            return jsonify(status="ready")
        return jsonify(status="not_ready"), 503

    @app.get("/v0/models")
    def models() -> Response:
        return jsonify(state.versions())

    @app.post("/v0/admin/reload")
    def reload() -> Response | tuple[Response, int]:
        try:
            state.reload()
        except (RuntimeError, ValueError, FileNotFoundError) as exc:
            return jsonify(error="reload failed", detail=str(exc)), 503
        return jsonify(state.versions())

    @app.post("/v0/recognize")
    def recognize() -> Response | tuple[Response, int]:
        upload = request.files.get("image")
        raw = request.form.get("request")
        if upload is None or raw is None:
            return jsonify(error="multipart fields `image` and `request` are required"), 400
        try:
            recognition_request = RecognitionRequest.model_validate_json(raw)
        except ValidationError as exc:
            details = exc.errors(include_input=False, include_url=False, include_context=False)
            return jsonify(error="invalid request", details=details), 400
        try:
            result = state.recognize(upload.read(), recognition_request)
        except RuntimeError as exc:
            return jsonify(error="service unavailable", detail=str(exc)), 503
        except ValueError as exc:
            # Undecodable image or dimensions that disagree with the request
            return jsonify(error="unprocessable image", detail=str(exc)), 422
        return Response(result.model_dump_json(), mimetype="application/json")

    @app.errorhandler(413)
    def too_large(_: Exception) -> tuple[Response, int]:
        return jsonify(error=f"upload exceeds {max_upload_mb} MB"), 413

    return app
