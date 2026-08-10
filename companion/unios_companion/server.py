from __future__ import annotations

import hmac
import json
import re
import time
from dataclasses import dataclass
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Optional

from .provider import OllamaProvider, ProviderUnavailable
from .store import PairingStore


MAX_BODY_BYTES = 64 * 1024
MAX_MESSAGE_CHARS = 12_000
DEVICE_ID_RE = re.compile(r"^[A-Za-z0-9._-]{8,128}$")


@dataclass
class CompanionService:
    store: PairingStore
    provider: OllamaProvider
    pairing_code: str
    pairing_expires_at: float
    lan_enabled: bool

    @classmethod
    def create(
        cls,
        *,
        state_dir: Path,
        model: str,
        ollama_url: str,
        pairing_code: str,
        pairing_ttl_seconds: int,
        lan_enabled: bool,
    ) -> "CompanionService":
        return cls(
            store=PairingStore(state_dir),
            provider=OllamaProvider(ollama_url, model),
            pairing_code=pairing_code,
            pairing_expires_at=time.monotonic() + pairing_ttl_seconds,
            lan_enabled=lan_enabled,
        )

    def health(self) -> dict[str, Any]:
        provider = self.provider.health()
        return {
            "status": "ready" if provider["available"] and provider["model_available"] else "degraded",
            "protocol_version": "1",
            "model": self.provider.model,
            "model_available": provider["model_available"],
            "pairing_required": True,
            "transport_security": "trusted-lan-experimental" if self.lan_enabled else "loopback-only",
        }

    def confirm_pairing(self, *, pairing_code: str, device_id: str, label: str) -> dict[str, str]:
        if time.monotonic() > self.pairing_expires_at:
            raise ValueError("The pairing code has expired. Restart the companion to create a new code.")
        if not hmac.compare_digest(pairing_code, self.pairing_code):
            raise PermissionError("The pairing code is invalid.")
        if not DEVICE_ID_RE.fullmatch(device_id):
            raise ValueError("device_id must contain 8-128 letters, digits, dots, underscores, or hyphens.")
        if not isinstance(label, str) or not label.strip() or len(label) > 80:
            raise ValueError("device_label must be 1-80 characters.")
        token = self.store.issue_token(device_id, label.strip())
        return {"device_id": device_id, "token": token, "token_type": "Bearer"}


def _json_response(handler: BaseHTTPRequestHandler, status: HTTPStatus, payload: dict[str, Any]) -> None:
    body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    handler.send_response(status.value)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Cache-Control", "no-store")
    handler.end_headers()
    handler.wfile.write(body)


def _parse_json(handler: BaseHTTPRequestHandler) -> dict[str, Any]:
    raw_length = handler.headers.get("Content-Length")
    if raw_length is None:
        raise ValueError("Content-Length is required.")
    try:
        length = int(raw_length)
    except ValueError as error:
        raise ValueError("Content-Length is invalid.") from error
    if length < 0 or length > MAX_BODY_BYTES:
        raise ValueError("Request body is too large.")
    try:
        payload = json.loads(handler.rfile.read(length).decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ValueError("Request body must be valid JSON.") from error
    if not isinstance(payload, dict):
        raise ValueError("JSON body must be an object.")
    return payload


def _bearer_token(handler: BaseHTTPRequestHandler) -> Optional[str]:
    authorization = handler.headers.get("Authorization", "")
    prefix = "Bearer "
    if not authorization.startswith(prefix):
        return None
    token = authorization[len(prefix) :].strip()
    return token or None


def build_handler(service: CompanionService) -> type[BaseHTTPRequestHandler]:
    class CompanionRequestHandler(BaseHTTPRequestHandler):
        server_version = "UniOSCompanion/0.1"

        def log_message(self, format: str, *args: Any) -> None:
            # Do not log request bodies, tokens, or prompts.
            print(f"[companion] {self.address_string()} {format % args}")

        def do_GET(self) -> None:
            if self.path == "/v1/health":
                _json_response(self, HTTPStatus.OK, service.health())
                return
            _json_response(self, HTTPStatus.NOT_FOUND, {"error": "not_found"})

        def do_POST(self) -> None:
            try:
                if self.path == "/v1/pair/confirm":
                    payload = _parse_json(self)
                    result = service.confirm_pairing(
                        pairing_code=str(payload.get("pairing_code", "")),
                        device_id=str(payload.get("device_id", "")),
                        label=str(payload.get("device_label", "")),
                    )
                    _json_response(self, HTTPStatus.CREATED, result)
                    return

                token = _bearer_token(self)
                device = service.store.authorize(token) if token else None
                if not device:
                    _json_response(self, HTTPStatus.UNAUTHORIZED, {"error": "unauthorized"})
                    return

                fingerprint = self.headers.get("X-Device-Fingerprint")
                if fingerprint != device.device_id:
                    _json_response(self, HTTPStatus.UNAUTHORIZED, {"error": "device_mismatch"})
                    return

                if self.path == "/v1/pair/revoke":
                    service.store.revoke(token or "")
                    _json_response(self, HTTPStatus.OK, {"revoked": True})
                    return

                if self.path == "/v1/chat":
                    payload = _parse_json(self)
                    message = payload.get("message")
                    if not isinstance(message, str) or not message.strip():
                        raise ValueError("message is required.")
                    if len(message) > MAX_MESSAGE_CHARS:
                        raise ValueError(f"message must not exceed {MAX_MESSAGE_CHARS} characters.")
                    try:
                        response = service.provider.chat(message.strip())
                    except ProviderUnavailable:
                        _json_response(
                            self,
                            HTTPStatus.SERVICE_UNAVAILABLE,
                            {"error": "local_model_unavailable", "retryable": True},
                        )
                        return
                    _json_response(
                        self,
                        HTTPStatus.OK,
                        {
                            "response": response,
                            "sources": [],
                            "grounded": False,
                            "model": service.provider.model,
                        },
                    )
                    return

                _json_response(self, HTTPStatus.NOT_FOUND, {"error": "not_found"})
            except PermissionError as error:
                _json_response(self, HTTPStatus.UNAUTHORIZED, {"error": "pairing_rejected", "message": str(error)})
            except ValueError as error:
                _json_response(self, HTTPStatus.BAD_REQUEST, {"error": "invalid_request", "message": str(error)})

    return CompanionRequestHandler


def run_server(host: str, port: int, service: CompanionService) -> None:
    server = ThreadingHTTPServer((host, port), build_handler(service))
    server.daemon_threads = True
    try:
        server.serve_forever(poll_interval=0.5)
    finally:
        service.store.close()
        server.server_close()
