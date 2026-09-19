"""HTTP recognition service backed by the promoted models in a registry.

POST /v0/recognize     multipart: `image` file + `request` field (RecognitionRequest JSON) -> RecognitionResult
GET  /v0/models        versions currently loaded
POST /v0/admin/reload  re-read CURRENT pointers and swap models without a restart
GET  /health           liveness, no auth

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
        self.reload()

    def reload(self) -> None:
        classifier = current_checkpoint(self.registry, "classifier")
        detector = current_checkpoint(self.registry, "detector")
        if classifier is None and detector is None:
            raise RuntimeError(f"no promoted models in {self.registry}; run `holotrace-ml promote` first")
        # Load outside the lock so requests keep being served by the old models while new ones load
        recognizer = Recognizer(classifier, detector)
        with self._lock:
            self.recognizer = recognizer

    def versions(self) -> dict[str, str | None]:
        meta = self.recognizer
        return {
            "classifier": meta.classifier_meta["model_version"] if meta.classifier_meta else None,
            "detector": meta.detector_meta["model_version"] if meta.detector_meta else None,
        }

    def recognize(self, image: bytes, recognition_request: RecognitionRequest) -> RecognitionResult:
        # Serialized: CPU inference already uses every core, and this keeps model swaps atomic
        with self._lock:
            return self.recognizer.recognize(image, recognition_request)


def create_app(registry: Path, api_key: str, *, max_upload_mb: int = 20) -> Flask:
    if len(api_key) < 32:
        raise ValueError("API key must be at least 32 characters")
    app = Flask(__name__)
    app.config["MAX_CONTENT_LENGTH"] = max_upload_mb * 1024 * 1024
    state = ModelState(registry)
    expected = api_key.encode()

    @app.before_request
    def require_key() -> tuple[Response, int] | None:
        if request.endpoint == "health":
            return None
        header = request.headers.get("Authorization", "")
        token = header.removeprefix("Bearer ").encode() if header.startswith("Bearer ") else b""
        if not hmac.compare_digest(token, expected):
            return jsonify(error="unauthorized"), 401
        return None

    @app.get("/health")
    def health() -> Response:
        return jsonify(status="ok")

    @app.get("/v0/models")
    def models() -> Response:
        return jsonify(state.versions())

    @app.post("/v0/admin/reload")
    def reload() -> Response | tuple[Response, int]:
        try:
            state.reload()
        except (RuntimeError, ValueError, FileNotFoundError) as exc:
            return jsonify(error="reload failed", detail=str(exc)), 500
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
        except ValueError as exc:
            # Undecodable image or dimensions that disagree with the request
            return jsonify(error="unprocessable image", detail=str(exc)), 422
        return Response(result.model_dump_json(), mimetype="application/json")

    @app.errorhandler(413)
    def too_large(_: Exception) -> tuple[Response, int]:
        return jsonify(error=f"upload exceeds {max_upload_mb} MB"), 413

    return app
