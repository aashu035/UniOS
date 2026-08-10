from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen


class ProviderUnavailable(RuntimeError):
    pass


def require_loopback_url(url: str) -> str:
    parsed = urlparse(url)
    if parsed.scheme != "http" or parsed.hostname not in {"127.0.0.1", "localhost", "::1"}:
        raise ValueError("The local model URL must use http on a loopback address.")
    return url.rstrip("/")


@dataclass(frozen=True)
class OllamaProvider:
    base_url: str
    model: str

    def __post_init__(self) -> None:
        object.__setattr__(self, "base_url", require_loopback_url(self.base_url))

    def health(self) -> dict[str, Any]:
        try:
            with urlopen(f"{self.base_url}/api/tags", timeout=2) as response:
                payload = json.loads(response.read().decode("utf-8"))
            models = {entry.get("name") for entry in payload.get("models", [])}
            return {"available": True, "model_available": self.model in models, "error": None}
        except (HTTPError, URLError, TimeoutError, OSError, json.JSONDecodeError) as error:
            return {"available": False, "model_available": False, "error": str(error)}

    def chat(self, message: str) -> str:
        payload = {
            "model": self.model,
            "stream": False,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You are UniOS, a private local academic tutor. Explain clearly, state uncertainty, "
                        "and never claim to have seen material that was not supplied."
                    ),
                },
                {"role": "user", "content": message},
            ],
        }
        request = Request(
            f"{self.base_url}/api/chat",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urlopen(request, timeout=120) as response:
                result = json.loads(response.read().decode("utf-8"))
        except (HTTPError, URLError, TimeoutError, OSError, json.JSONDecodeError) as error:
            raise ProviderUnavailable("The configured local model is unavailable.") from error
        text = result.get("message", {}).get("content")
        if not isinstance(text, str) or not text.strip():
            raise ProviderUnavailable("The configured local model returned no usable response.")
        return text.strip()
