# UniOS requirements traceability matrix

**Status:** Working baseline for implementation and acceptance testing. Product-discovery inputs are from the project owner; references `E1`–`E8` point to the source register in [`evidence-register.md`](evidence-register.md).

## Functional requirements

| ID | Requirement | Source | Acceptance evidence | Owner |
| --- | --- | --- | --- | --- |
| FR-01 | A fresh installation shall create no sample profile, course, task, attendance record, resource, event, or study session. Immutable grading data may be seeded separately. | D2 | Install on a new app-data state; all academic lists are empty and lead to creation actions. | Antigravity |
| FR-02 | A student shall create, edit, activate/archive, and delete semesters. | Product direction | Semester test: changes persist after relaunch; one active semester at a time. | Antigravity |
| FR-03 | A student shall create, edit, and delete courses/workspaces with user-controlled metadata. | D2, E3 | Form validation; data remains correct after relaunch. | Antigravity |
| FR-04 | Deleting a course shall require confirmation and remove only its dependent tasks, resources, attendance, calendar/timeline, and snapshots—never unrelated courses. | D2 | Seed two real test courses with children; delete one; verify the other is intact and no orphaned records remain. | Antigravity + Codex integration gate |
| FR-05 | Adding a recurring class shall require an explicit course and at least one independently selected weekday; it shall create no occurrence on unselected days. | D3 | Create Mon/Wed class; inspect planner for two selected occurrences only. | Antigravity |
| FR-06 | One-time events shall support an explicit date and categories including holiday, minor/exam, assignment/homework, important work, and personal. | Product direction | Create/edit/delete each category; verify chronological planner display. | Antigravity |
| FR-07 | A student shall add, open, rename/tag, and delete documents, links, notes, PYQs, books, exercises, and answers. | D2 | Device-file, link, and text-note test; open result; delete result and verify metadata/file cleanup. | Antigravity |
| FR-08 | Home and planner shall show only stored data and useful empty states, never fabricated counts, tasks, uploads, or attendance. | D1, D2 | Fresh-state screenshot review and seeded-test comparison. | Shared: visual owner to be explicitly claimed |
| FR-09 | The app shall remain usable offline for all non-AI academic workflows. | Product direction | Enable airplane mode; repeat course, task, event, material, and study-session flows. | Codex integration gate |
| FR-10 | The Tutor shall be optional and shall not block startup or normal academic workflows when the laptop is unavailable. | E6, E7 | Start app with companion stopped/wrong IP; normal app works and Tutor shows recoverable offline state. | Codex |
| FR-11 | A student shall explicitly select any material that may be copied/indexed for the companion, and shall revoke/remove it later. | E6, E7, E8 | Attempt unauthorised index; revoke authorised item; verify it is no longer retrievable. | Codex |
| FR-12 | AI-extracted dates/tasks/events shall be presented as candidates with source evidence and require student confirmation before any write. | E6, E7 | Ambiguous source test; no calendar/task mutation until explicit confirmation. | Codex |

## Quality requirements

| ID | Requirement | Measure / pass condition | Owner |
| --- | --- | --- | --- |
| QR-01 | The release APK shall embed its JavaScript bundle and start beyond the native splash on a real device without Metro. | Inspect APK bundle; launch after fresh install; capture `adb logcat` if it fails. | Codex, startup hand-off from Antigravity |
| QR-02 | Static validation shall stay clean. | `npm.cmd run typecheck` exits 0; `git diff --check` has no whitespace errors for feature-complete files. | Codex integration gate |
| QR-03 | Failure states shall be visible and recoverable. | Migration, file-picker, open-file, database, and Tutor connection failures show concise retry/help state; no forced close. | Shared |
| QR-04 | Data deletion shall be intentional and scoped. | Confirmation identifies exact target; test proves no unrelated records/files are deleted. | Antigravity + Codex integration gate |
| QR-05 | Privacy shall be explainable. | UI exposes connection status, indexed-material list, revoke, delete/reset, and export controls; no cloud endpoint or hidden telemetry. | Codex |
| QR-06 | Accessibility shall be considered. | Touch targets, labels, contrast, error copy, and text scaling reviewed on priority flows. | Shared |

## Release gates

1. All functional requirements for the release scope pass on a clean app-data state.
2. Existing-demo cleanup, if offered, lists exact data and requires confirmation.
3. No crash occurs on the priority flows: onboarding, semester, course, schedule, task, resource, deletion, app restart.
4. The device release test confirms that the native splash disappears and the app renders a usable state.
5. AI features remain labelled experimental until encrypted/authenticated pairing, material consent/revocation, source disclosure, and actual-device benchmarks pass.

