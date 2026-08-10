# UniOS local companion

This is the optional laptop-side service for the UniOS Tutor. It is deliberately separate from the Android app: the phone remains useful without it, and this service does not call a cloud AI API.

## Current capability

- exposes a local health endpoint and an explicit, expiring pairing flow;
- stores only hashed issued device tokens in a local SQLite state database;
- forwards authenticated chat requests to an already-running **local** Ollama service on the laptop; and
- never persists question or response text in the companion.

Material indexing/retrieval, source citations, and TLS/certificate pinning are not implemented here yet. The service reports no sources rather than pretending a general model answer is grounded in student material.

## Requirements

- Python 3.11 or newer; no third-party Python package is required.
- A local Ollama installation and a locally available model, if chat responses are needed. The companion uses `http://127.0.0.1:11434` by default and rejects non-loopback model URLs.

Example local model preparation (performed by the laptop owner, not by UniOS automatically):

```powershell
ollama serve
ollama pull <your-approved-local-model>
```

## Run it

From the repository root:

```powershell
python companion\run.py --model <your-approved-local-model>
```

The safe default listens only on `127.0.0.1`, so it cannot be reached by a phone. To deliberately expose the service to a phone on a trusted private LAN or USB-tether network:

```powershell
python companion\run.py --host 0.0.0.0 --allow-lan --model <your-approved-local-model>
```

The service prints a short-lived pairing code in the laptop terminal. A future phone client must call `POST /v1/pair/confirm` with that code and store the server-issued bearer token. **A successful health request is not a pairing event.**

> `--allow-lan` is experimental: this first transport is authenticated with a short-lived pairing code and bearer token, but it does not yet provide certificate-pinned encrypted transport. Do not use it on an untrusted network or claim it is production-secure.

## HTTP contract

| Endpoint | Authentication | Purpose |
| --- | --- | --- |
| `GET /v1/health` | None | Local capability/readiness only. It never pairs a device. |
| `POST /v1/pair/confirm` | Short-lived terminal pairing code in JSON body | Issues a new bearer token for a named device. |
| `POST /v1/chat` | `Authorization: Bearer <issued-token>` and matching `X-Device-Fingerprint` | Sends a bounded question to the local model. |
| `POST /v1/pair/revoke` | Issued bearer token | Revokes the calling device token. |

### Pair confirmation request

```json
{
  "pairing_code": "code printed by the companion",
  "device_id": "cryptographically-random phone identifier",
  "device_label": "Harsh's phone"
}
```

The success response includes a `token`. The phone must treat it as secret and store it in platform-protected storage; it must never be logged or displayed again.

### Chat request

```json
{
  "message": "Explain the concept in simple terms."
}
```

The response is `{ "response", "sources", "grounded", "model" }`. `grounded` is `false` and `sources` is empty until explicit material indexing/retrieval is implemented.

## Verification

```powershell
Push-Location companion
python -m unittest discover -s tests -v
Pop-Location
```

These tests verify token issuance, expiry/revocation behaviour, and the safe default binding policy without downloading a model or calling the network.
