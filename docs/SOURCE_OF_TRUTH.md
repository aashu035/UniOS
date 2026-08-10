# UniOS Source of Truth

## Purpose

This file prevents contradictions between product documents, implementation notes, migrations, and the running app. It governs **where a decision belongs** and **which artifact wins** when two artifacts disagree.

## Authority order

| Question | Canonical authority | Supporting documents | Rule when they conflict |
| --- | --- | --- | --- |
| Why the product exists, target student, outcomes, priority, scope, or non-goals | [`product/PRD.md`](product/PRD.md) | Design specification, feasibility package | PRD wins unless the project owner revises it. |
| What the system is approved to do; functional/non-functional requirement; acceptance condition | [`requirements/SRS.md`](requirements/SRS.md) | Requirements traceability matrix | SRS wins for approved requirements. Update it before implementing a changed requirement. |
| What persistent data exists now | `domains/*/model.ts` and applied `drizzle/*.sql` migrations | [`architecture/ERD.md`](architecture/ERD.md) | Code plus migration history wins. ERD must be corrected in the same change. |
| How components communicate; privacy, offline, and reliability boundaries | [`architecture/ARCHITECTURE.md`](architecture/ARCHITECTURE.md) | `ai/local-companion-architecture.md` | Architecture wins for approved system boundaries; code must be reconciled before release. |
| Which runtime/library/version/build command is selected | [`architecture/TECH_STACK.md`](architecture/TECH_STACK.md), `package.json`, lockfile, native Gradle files | README | Installed manifest/native files win for current implementation; Tech Stack records rationale and intended support. |
| How a contributor runs the project | [`../README.md`](../README.md) | `package.json` scripts, Android project | The executable script/config wins; update README immediately if instructions fail. |
| Evidence/statistics used in professional documents | [`project-package/evidence-register.md`](project-package/evidence-register.md) | Original linked source | Original source wins; replace stale claims rather than silently retaining them. |

## Document responsibilities

| File | Owner | Must contain | Must not contain |
| --- | --- | --- | --- |
| `docs/product/PRD.md` | Antigravity | Product intent, users, journeys, priorities, scope, success measures | Detailed database columns or normative implementation rules |
| `docs/requirements/SRS.md` | Codex | Stable requirement IDs, shall statements, acceptance criteria, quality/privacy requirements | Competing product roadmap |
| `docs/architecture/ERD.md` | Codex | Current entities, relationships, keys, nullable/constraint notes, migration mapping | Proposed tables represented as already implemented |
| `docs/architecture/ARCHITECTURE.md` | Codex | Runtime boundaries, data flow, interfaces, failure modes, security decisions | Library-version inventory |
| `docs/architecture/TECH_STACK.md` | Antigravity | Actual stack, dependencies, commands, rationale, version/source | Duplicate architecture diagrams or unapproved future dependencies |
| `README.md` | Antigravity | Fast onboarding, quick run/test/build, status, document links | Full SRS/PRD/ERD |
| `docs/project-package/*` | Codex | Evidence, traceability, feasibility materials, research limits | A hidden replacement for the PRD or SRS |

## Status vocabulary

Use one of the following words whenever a document describes a feature:

- **Implemented** — present in code and covered by a migration/runtime path where needed.
- **In progress** — actively owned and being changed; do not treat as release-ready.
- **Approved design** — accepted plan, not yet implemented.
- **Proposed** — analysis only; requires owner approval before implementation.
- **Rejected** — intentionally not part of the product.

Never use “supported” or “production-ready” unless release verification has passed.

## Change-control protocol

1. Identify the owning document in the authority table before changing behaviour or data.
2. Record an ownership claim in [`collaboration/CODEX_ANTIGRAVITY_COLLABORATION.md`](collaboration/CODEX_ANTIGRAVITY_COLLABORATION.md) before changing a shared boundary (`core/db/schema.ts`, `drizzle/`, root routing, or an owned document).
3. Update the canonical artifact first or in the same patch as implementation.
4. Update cross-references and the traceability matrix if an acceptance condition changes.
5. Run the relevant check and record its result: type check, migration test, release bundle check, and/or device flow test.
6. If disagreement remains, stop the conflicting change, log the alternatives, and request a project-owner decision.

## Implementation authority map

| Area | Current code authority | Notes |
| --- | --- | --- |
| Router and startup | `app/_layout.tsx`, `app/**`, `app.json`, `android/**` | Native splash/startup claims require a real-device verification. |
| UI primitives and visual tokens | `components/**`, `tokens/**`, `DESIGN_PRINCIPLES.md` | Screen-specific behaviour is defined by its route and domain hook. |
| Local database connection | `core/db/client.ts` | Database file is `unios.db`. |
| Database schema exports | `core/db/schema.ts` and `domains/*/model.ts` | Models define current table shape. |
| Migration history | `drizzle/meta/_journal.json`, `drizzle/*.sql`, `drizzle/migrations.js` | Do not edit applied migration history destructively. |
| Domain operations | `domains/*/repository.ts`, `domains/*/hooks.ts` | Repository transactions own cross-table integrity in the present SQLite schema. |
| Local AI companion pair/chat implementation | `companion/**`, `app/settings/pairing.tsx`, `app/tutor/index.tsx`, `domains/ai/**`, and applied migrations | Implemented experimental local-only pair/chat. `docs/ai/local-companion-architecture.md` defines the approved privacy/security boundary; encrypted transport, retrieval, citations, and candidate workflows remain future requirements. |

## Conflict examples

| If this happens | Do this |
| --- | --- |
| PRD says a feature is priority but SRS lacks a requirement | Add/review an SRS requirement before coding. |
| ERD says a field exists but model/migration does not | Correct ERD; do not create code based on the diagram alone. |
| README command fails although it is documented | Update README and Tech Stack from executable configuration; log the verification. |
| A local-AI proposal needs new SQLite tables | Do not add tables from the architecture document alone; claim schema/migration ownership, add a migration, then refresh ERD and SRS traceability. |
| User asks for a feature that conflicts with privacy/offline rules | Capture the product decision in PRD and revise SRS/architecture before implementation. |
