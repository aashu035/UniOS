# 🤖 Agent Coordination Cache (Hermes ↔ Antigravity)

Shared memory for Hermes (supervisor/auditor/cleanup) and Antigravity (AGY, feature implementation).
**Read this file BEFORE taking major actions. Update on task claim/completion.**

## 📡 Current Status
**Active Agents:** Hermes (cleanup) + AGY (features) — **PARALLEL LANES (see below)**
**Current Focus:** Phase A (cosmetic cleanup) ✅ + Phase B (metric engine reconciliation) ✅
**Timestamp:** 2026-09-05

## ✅ Phase A + B complete (Hermes)

**Phase A — surgical cleanup**
- **A1**: `CourseListService` now returns `primaryFacultyName` + `primaryVenueName`; `SubjectCard` renders CourseIcon + venue under title. Both `app/(main)/workspaces.tsx` and `app/(main)/semester.tsx` wired. Commit `425f411`.
- **A2**: Replaced hardcoded "Official Portal data unavailable. Last synced: Never." with honest copy in `app/workspace/[id]/attendance.tsx:204`. Mirror file `app/course/attendance.tsx` was already clean. Commit `400c80b`.
- **A3**: Documented the migration numbering gap (0009 missing, duplicate 0012 filenames) in `drizzle/MIGRATION_NUMBERING.md` rather than renumbering — the runtime uses `mNNNN` aliases in `drizzle/migrations.js` so it's correct, and renaming would risk breaking existing installs. Follow-up plan included. Commit `0223d03`.

**Phase B — metric engine reconciliation**
- **B1**: Audited both engines. The "two engines" framing in the audit was imprecise — `calculateAttendanceMetrics` (pure fn) is the canonical engine, used by `AttendanceViewModelBuilder`, `CourseListService`, `CourseOverviewService`, and `WorkspaceRepository.getCompleteWorkspace`. The "second engine" was `AttendanceService.getLocalAttendanceState()`, which had **zero consumers** anywhere in the app, components, or other domains.
- **B2**: Removed the dead `getLocalAttendanceState` (~50 lines of inlined math) from `domains/attendance/service.ts`. Other methods (`getPortalAttendanceState`, `markLocalAttendance`, `updatePortalAttendance`) kept — different data domain (portal read-only), real consumers.
- **B3**: Pinned the canonical engine with regression tests in `core/utils/attendance.test.ts`. **Found a real contract pitfall while writing the tests**: the canonical function returns `present` as raw present count (not present+exempt), and the consumer in `app/workspace/[id]/attendance.tsx:151,160,167` adds `displayExempt` separately to compute "effective attended" for target% recovery. The test now pins this contract explicitly. **8/8 tests pass.** Commit `e325eb3`.

## 🚦 PARALLEL LANES (still active)

### 🟢 Hermes next (Phase C — carry-forward, optional)
- `pending_issues.md` re-verification (it was updated by AGY in an earlier turn; cross-check with current code).
- `AGENT_SYNC.md` (this file) — keep updated.
- Documentation in `Audit/` or `docs/` if anything is misleading.
- Could tackle the audit's "Attendance calculation duplication" entry now formally closed since `getLocalAttendanceState` is removed.

### 🟢 AGY next (parallel-safe lanes)
- **Notification producer**: implement a producer in `domains/notification/service.ts` + `repository.ts` so the bell badge can light up honestly. Hermes will not touch notification.
- **Resource viewer polish**: `app/resource/index.tsx` / detail screen.
- **Onboarding hardening**: `app/onboarding/**`.
- **Settings screen**: if a settings screen exists, hardening it.
- **New test files in `__tests__/`**: no conflict.
- **Documentation in `docs/`**: pure doc, no conflict.
- **Course write path refinements**: `app/course/add.tsx`, `app/workspace/add.tsx`, `domains/workspace/buildCompleteWorkspace`. Hermes stays off the write path.

### 🟡 SHARED — coordinate BEFORE editing
- `domains/workspace/hooks.ts` (`useWorkspaces`, `useWorkspace` — read paths)
- `app/(main)/home.tsx`, `app/(main)/planner.tsx` (render the workspace list)
- `domains/attendance/hooks.ts` and `viewmodel.ts`
- Any `components/cards/*` or `components/feedback/*` (shared UI primitives)

### 🔴 OFF LIMITS to both (unless user explicitly authorizes)
- `app/_layout.tsx` (route registry)
- `package.json` (no new deps)
- `tsconfig.json`
- Drizzle migration SQL (only `_journal.json` and one rename in scope if ever)

## 📝 Task Allocation (updated)
| Task | Owner | Status | Notes |
|------|-------|--------|-------|
| P0 typecheck gate | Hermes | ✅ Done | |
| P1 correctness (mockExams, TBD, dead UI) | Hermes | ✅ Done | |
| Premium metallic glass UI | Hermes | ✅ Done | |
| TASK-01 native date picker | AGY | ✅ Done | |
| TASK-02 priority behavior | AGY | ✅ Done | |
| RESOURCE-01/02 workspace selection | AGY | ✅ Done | |
| **A1: course list exposes icon + venue** | Hermes | ✅ Done | 425f411 |
| **A2: honest "Portal unavailable" copy** | Hermes | ✅ Done | 400c80b |
| **A3: document migration numbering** | Hermes | ✅ Done | 0223d03 |
| **B: metric engine reconciliation** | Hermes | ✅ Done | e325eb3 |
| (parallel) Notification producer | AGY | ⟡ Optional | safe parallel lane |
| (parallel) Resource viewer polish | AGY | ⟡ Optional | safe parallel lane |
| (parallel) Onboarding/Settings hardening | AGY | ⟡ Optional | safe parallel lane |
| `pending_issues.md` re-verify | Hermes | ⏳ Optional | quick sanity pass |

## 🧠 Shared Reasoning & Logs
- **Hermes (2026-09-05):** Found a real contract pitfall while writing the metric engine regression tests. The canonical function returns `present` as raw present count (not present+exempt). The consumer at `app/workspace/[id]/attendance.tsx:151,160,167` adds `displayExempt` separately for "effective attended" calculations. This is now pinned in the test suite as the explicit contract, so any future change will be caught. **Lesson**: a test pinned to a consumer is more valuable than a test pinned to the function alone.
- **Hermes (2026-09-05):** The forensic audit's "Phase 1: read-path fix" was already done before we started — `getCompleteWorkspace` exists and is used. The "Phase 2: unify scheduling" was also done — `getEventsForDay` was removed with a comment. The remaining real work was P2/P3 cleanup, which is now done.
- **Coordination rule established and working:** Both agents worked in declared lanes. Zero collisions this round.

## ⚠️ Open / Not Yet Done (carry-forward)
- `pending_issues.md` re-verify against current code (Hermes optional, next session).
- Notifications domain producers (AGY optional lane).
- `Godot_v4.7.2-stable_win64.exe/`, `test_*.db`, `test_db_dump.sql`, `scratch/` sitting untracked at root — do NOT commit as-is.
- Drizzle migration renumbering (requires `drizzle-kit generate` plan; documented in `drizzle/MIGRATION_NUMBERING.md`).
