from __future__ import annotations

import json
import tempfile
import threading
import unittest
from http.server import ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from unios_companion.server import CompanionService, build_handler


class FakeProvider:
    model = "fake-local-model"

    def health(self):
        return {"available": True, "model_available": True, "error": None}

    def chat(self, message: str) -> str:
        return f"local answer: {message}"


class HttpContractTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.service = CompanionService.create(
            state_dir=Path(self.temp_dir.name),
            model="test-model",
            ollama_url="http://127.0.0.1:11434",
            pairing_code="test-code",
            pairing_ttl_seconds=60,
            lan_enabled=False,
        )
        self.service.provider = FakeProvider()  # type: ignore[assignment]
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), build_handler(self.service))
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        host, port = self.server.server_address
        self.base_url = f"http://{host}:{port}"

    def tearDown(self) -> None:
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)
        self.service.store.close()
        self.temp_dir.cleanup()

    def request_json(self, path: str, payload: dict | None = None, headers: dict | None = None):
        body = None if payload is None else json.dumps(payload).encode("utf-8")
        request_headers = {} if headers is None else headers.copy()
        if body is not None:
            request_headers["Content-Type"] = "application/json"
        request = Request(f"{self.base_url}{path}", data=body, headers=request_headers, method="POST" if body else "GET")
        with urlopen(request, timeout=3) as response:
            return response.status, json.loads(response.read().decode("utf-8"))

    def test_health_does_not_pair_and_confirm_then_chat_requires_token(self) -> None:
        status, health = self.request_json("/v1/health")
        self.assertEqual(200, status)
        self.assertTrue(health["pairing_required"])

        with self.assertRaises(HTTPError) as unauthorized:
            self.request_json("/v1/chat", {"message": "hello"})
        self.assertEqual(401, unauthorized.exception.code)

        _, paired = self.request_json(
            "/v1/pair/confirm",
            {"pairing_code": "test-code", "device_id": "phone-12345678", "device_label": "Test phone"},
        )
        headers = {
            "Authorization": f"Bearer {paired['token']}",
            "X-Device-Fingerprint": paired["device_id"],
        }
        status, answer = self.request_json("/v1/chat", {"message": "hello"}, headers)
        self.assertEqual(200, status)
        self.assertEqual("local answer: hello", answer["response"])
        self.assertFalse(answer["grounded"])
        self.assertEqual([], answer["sources"])


if __name__ == "__main__":
    unittest.main()
