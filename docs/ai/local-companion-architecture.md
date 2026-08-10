# UniOS private local-AI companion

## Decision

UniOS will use a **laptop-first companion** for optional AI features. The Android app stays the student's offline source of truth; it must never require an AI server for planning, tasks, materials, or progress logging. No cloud inference API, telemetry, or automatic material upload is permitted.

This design deliberately separates useful personalisation from model training:

- **Release 1:** private learning profile + retrieval over explicitly selected materials + feedback-driven preferences;
- **later, opt-in:** a lightweight local adapter experiment only after the baseline is reliable and measurable;
- **never assumed:** universal-model training or use of the phone/laptop RAM as a single shared memory pool. The model runs on one machine at a time; the laptop is the quality-first inference host.

## System boundary

```text
Android UniOS app (offline source of truth)
  ├─ SQLite: courses, schedule, tasks, material metadata, study sessions
  ├─ pairing record + local tutor history (implemented)
  ├─ Expo SecureStore bearer token (implemented)
  ├─ material-selection and review UI (planned)
  └─ local companion client (implemented experimental)
              │
              │  local LAN or USB-tether network only
              ▼
Laptop companion (separate process; local-only)
  ├─ expiring pairing-code and hashed-token store (implemented)
  ├─ authenticated health/pair/chat/revoke API (implemented)
  ├─ loopback-only Ollama adapter and selected local model (implemented)
  ├─ local embedding + retrieval index (planned)
  ├─ source/citation builder (planned)
  └─ candidate-extraction endpoints (planned; never write directly to phone data)
```

## Non-negotiable product rules

1. **Explicit context:** the app sends only the current question, requested preference fields, and materials the student has selected for that request/index.
2. **No autonomous data changes:** detected holidays, exams, tasks, homework, or timetable entries return as candidates. The student reviews and confirms each one before UniOS writes it.
3. **Grounded responses:** when a response uses indexed material, it shows the source title, chunk/page reference when available, and an “outside my materials” label when it is general knowledge.
4. **Honest offline state:** if the companion is unreachable, the rest of UniOS works; the Tutor screen offers reconnect/retry guidance instead of loading forever.
5. **No unsupported learning claims:** personalisation changes explanation format and study prompts, not grades or ability labels.
6. **Delete means delete:** the student can remove a material from the index, revoke a paired laptop, clear chat history, export local data, and reset the learning profile.

## Phased delivery

| Phase | Deliverable | Exit criteria |
| --- | --- | --- |
| 0 — contract | API, consent boundaries, failure states, and benchmark plan | **Implemented** for the pair/chat contract; transport remains experimental. |
| 1 — local connection | Companion health check, manual pairing, connection status, and typed tutor chat | **Implemented experimental.** Pair and chat use bounded requests; real-device validation and encrypted transport remain required. |
| 2 — private retrieval | Student-approved material ingestion, local chunks/embeddings, cited answer, index/delete/rebuild controls | **Not implemented.** Every answer must list context sources; a removed material must not appear after re-index verification. |
| 3 — academic workflows | Candidate extraction for dates/tasks and study-question generation | All app changes require a review/confirm screen; test set proves no silent writes. |
| 4 — measurable personalisation | Editable profile + response feedback; optional local adapter research | Evaluation improves quality for the owner’s approved test prompts without adding cloud dependency or degrading baseline answers. |

## Phone-side records

The following records are implemented in migrations `0002`–`0004`. The bearer token is intentionally absent from this schema and kept in Expo SecureStore, keyed by `ai_connections.id`.

| Record | Minimum fields | Purpose |
| --- | --- | --- |
| `ai_connections` | `id`, `label`, `base_url`, `device_fingerprint`, `pairing_state`, `created_at`, `last_verified_at`, `revoked_at` | Stores the user-approved local companion, never an API key. |
| `learning_profiles` | `id`, `preferred_language`, `explanation_depth`, `example_style`, `pace`, `accessibility_notes`, `updated_at` | Explicit preference fields—not an opaque learner score. The editable settings UI is still planned. |
| `material_index_permissions` | `id`, `resource_id`, `connection_id`, `status`, `content_hash`, `approved_at`, `revoked_at` | Records which resource may be copied/indexed on which companion. |
| `tutor_conversations` | `id`, `connection_id`, `title`, `created_at`, `deleted_at` | Optional local conversation metadata. |
| `tutor_messages` | `id`, `conversation_id`, `role`, `body`, `source_manifest`, `created_at`, `deleted_at` | Local history, source disclosure, and deletion support. |

The material records are consent metadata only; the app does not yet send a resource to the laptop. The safe future default is **no background sync**: upload/copy only after explicit per-material approval, show size/hash, and allow removal at either end.

## Pairing and transport requirements

The implemented pair/chat feature supports a trusted private LAN or USB-tether network, but it is not production-ready merely because it uses a local IP address. It currently provides an expiring terminal pairing code, a server-issued per-device bearer token, protected phone storage, authenticated revocation when reachable, and bounded phone-side timeouts. Before calling it a production feature, it must additionally provide:

1. a companion device identity and human-verifiable fingerprint/QR code;
2. an authenticated encrypted connection or an equivalent reviewed transport design; a bearer token over plain HTTP is insufficient for study materials; and
3. a real-device test record covering timeout, cancellation, revocation, re-pairing, and no indefinite startup wait.

Until those controls exist, the release notes must label the connection an **experimental local-network feature**.

## API contract

All endpoints are provided by the laptop companion; all mutations are reviewed in the phone app.

| Endpoint | Request | Response / safety property |
| --- | --- | --- |
| `GET /v1/health` | None | **Implemented.** Capability/local-only status; never pairs a device. |
| `POST /v1/pair/confirm` | Pairing code, device ID, device label | **Implemented.** Returns a server-issued bearer token for that device. |
| `POST /v1/chat` | Issued bearer token, matching device ID, question | **Implemented.** Returns a local general answer with `grounded: false` and no sources. |
| `POST /v1/pair/revoke` | Issued bearer token and matching device ID | **Implemented.** Revokes the calling laptop-side token. |
| `POST /v1/materials/index`, `POST /v1/materials/remove` | Explicit material manifest/content | **Planned.** Require per-item approval, content hash, index/remove acknowledgement, and source tests. |
| `POST /v1/extract/candidates`, `POST /v1/study/generate` | Explicit selected material | **Planned.** Candidate-only response; no automatic academic data writes. |

## Model and hardware policy

The companion should choose a locally installed, licence-reviewed instruct model after a benchmark on the actual laptop. A quantized 7–8B class model is a sensible **starting hypothesis**, not a guarantee: real usability depends on laptop RAM, CPU, GPU support, context length, operating system, model format, and the desired response time.

The benchmark must record at least:

- cold-start time and model-load time;
- tokens per second for a short answer and material-grounded answer;
- maximum stable context/index size;
- laptop memory/VRAM use and thermals; and
- answer quality on a student-owned, consented evaluation set.

The 12 GB phone RAM cannot be pooled with laptop RAM as one shared runtime. It is useful for the Expo app, viewing materials, and small local operations; the laptop executes the quality-first model and returns a response over the local connection.

## Quality and safety test matrix

| Risk | Required test | Release behaviour |
| --- | --- | --- |
| Companion unreachable | Airplane mode / wrong IP / stopped service | Tutor shows offline/retry state within timeout; planner remains usable. |
| Unauthorised material exposure | Try indexing without permission; revoke then search | Reject unauthorised item; revocation removes access/index. |
| Hallucinated scheduling | Date extraction with ambiguous text | Mark ambiguity and demand user confirmation; never create an event automatically. |
| Unsupported answer | Ask outside selected materials | State that material support is unavailable; distinguish general answer from cited content. |
| Slow/failed inference | Cancel during generation; simulate timeout | Cancel cleanly; no frozen screen or duplicated records. |
| Personalisation drift | Compare baseline and preference-specific prompt suite | Preferences must be visible, editable, resettable, and never change facts/sources. |

## Files and change control

Codex can add new AI-specific modules and documentation. Before changing `core/db/schema.ts`, `drizzle/`, root routing, or shared resource models, record the exact proposal in `docs/collaboration/CODEX_ANTIGRAVITY_COLLABORATION.md` and wait for an ownership hand-off. This prevents the AI work from corrupting the academic CRUD/migration work in progress.
