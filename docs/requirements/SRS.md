# UniOS Software Requirements Specification (SRS)

**Version:** 0.1 — production-rebuild baseline  
**Status:** Approved requirements baseline; implementation status is recorded per requirement and must be verified before release.  
**Product intent:** Defined only in `docs/product/PRD.md`.  
**Traceability:** `docs/project-package/requirements-traceability-matrix.md`.  
**Authority:** This is the canonical source for normative “shall” requirements. See [Source of Truth](../SOURCE_OF_TRUTH.md).

## 1. Scope and terminology

UniOS is a private, local-first academic organiser for an individual student. Its core phone workflows include profile/setup, semesters, courses, timetable, tasks, attendance, materials, and progress. An optional paired laptop may later provide a local AI tutor; the app’s normal academic workflows shall not depend on it.

| Term | Meaning in this SRS |
| --- | --- |
| **Course** | A student’s academic subject. The current data model uses the internal table/domain name `workspace`. |
| **Semester** | A named/numbered academic period that can own multiple courses. |
| **Recurring class** | One class schedule with one or more explicitly selected weekdays. |
| **One-time event** | A dated event that does not repeat unless the student deliberately creates a recurrence. |
| **Resource** | Student-controlled material such as document, link, note, PYQ, reference book, exercise, or answer. |
| **Companion** | The optional laptop-local AI service; it is not a cloud API. |
| **Confirmation** | An explicit student action in a review surface; an AI suggestion alone is never confirmation. |

## 2. General constraints

- **C-01:** The core app shall not require internet access, a cloud API key, cloud inference, or telemetry to create, read, update, or delete academic records.
- **C-02:** Fresh installations shall not represent sample data as the student’s real academic data.
- **C-03:** All destructive actions shall identify their target and require confirmation when child data or managed files may be removed.
- **C-04:** Implemented database changes shall use an additive, versioned Drizzle migration; documentation-only proposals shall not be presented as schema.
- **C-05:** UI copy shall distinguish loading, empty, success, and recoverable error states.

## 3. Functional requirements

### 3.1 Startup, onboarding, and profile

| ID | Requirement | Status | Acceptance criteria |
| --- | --- | --- | --- |
| UNI-START-001 | On first launch after migrations, the app shall route a student with no profile to onboarding. | Implemented/in verification | Clean app-data test opens onboarding without fabricated course/task/material data. |
| UNI-START-002 | The app shall show a rendered success state, error state, or retry path after startup checks; it shall not remain indefinitely on the native splash or a blank loading screen. | In verification | Migration failure and normal start are tested on a release APK; neither requires Metro. |
| UNI-PROFILE-001 | The student shall create and edit their own name, enrolment number, university, branch, current semester, target CGPA, and optional profile image. | Implemented/in verification | Save, relaunch, and edit tests retain each changed field. |
| UNI-PROFILE-002 | The app shall keep profile data local by default. | Implemented design | Network-disabled test preserves all profile use. |

### 3.2 Semesters and courses

| ID | Requirement | Status | Acceptance criteria |
| --- | --- | --- | --- |
| UNI-SEM-001 | The student shall create, edit, activate, archive, and delete a semester with number, optional name, type, dates, and optional SGPA. | In progress | Each operation persists across relaunch; delete confirmation identifies affected courses. |
| UNI-SEM-002 | The app shall present an active-semester view containing only real semester/course data and actionable empty states. | In progress | New profile shows no invented semester analytics; action opens valid setup. |
| UNI-COURSE-001 | The student shall create and edit a course with name, optional code, credits, type, instructor, default venue, attendance target, colour, and notes. | Implemented/in verification | Validation rejects a missing name; saved course is visible and editable after relaunch. |
| UNI-COURSE-002 | The student shall delete any user-created course after confirmation. | In progress | Delete flow names the course and completes without a crash. |
| UNI-COURSE-003 | Deleting a course shall remove its dependent timeline entries, tasks, resources, attendance, portal-attendance snapshots, and calendar events in one integrity-preserving operation. | In progress | Two-course test proves only the selected course and its children are removed; no orphan rows remain. |
| UNI-COURSE-004 | The app shall not auto-create attendance, task, timeline, resource, or schedule records merely because a course was created. | In progress | Course creation test leaves all dependent lists empty. |

### 3.3 Timetable and planner

| ID | Requirement | Status | Acceptance criteria |
| --- | --- | --- | --- |
| UNI-PLAN-001 | The planner shall provide separate creation flows for a recurring class and a one-time event. | In progress | The student can choose the appropriate flow without relying on hidden defaults. |
| UNI-PLAN-002 | A recurring class shall require a course, start time, end time, and at least one explicitly selected weekday. No weekday shall be preselected. | In progress | A Mon/Wed class appears only on Monday and Wednesday. Saving with zero weekdays is rejected. |
| UNI-PLAN-003 | A recurring class shall have a stable group identity so editing/deleting the group updates/removes all of its selected weekday occurrences. | Approved design | Group edit/delete test affects every occurrence and no unrelated schedule entry. |
| UNI-PLAN-004 | A one-time event shall require a concrete date and support holiday, minor, exam, assignment/homework, important work, and personal categories. | In progress | Each category creates, displays, edits, and deletes correctly on its date only. |
| UNI-PLAN-005 | The day planner and home briefing shall render only persisted calendar/task data and shall display a useful empty state when no items exist. | In progress | Fresh-state and stored-state visual tests contain no placeholder lecture or fake deadline. |
| UNI-PLAN-006 | Planner validation shall reject an end time that is not later than its start time. | Approved design | Invalid input preserves the form and gives an understandable field error. |

### 3.4 Tasks, attendance, study progress, and notifications

| ID | Requirement | Status | Acceptance criteria |
| --- | --- | --- | --- |
| UNI-TASK-001 | The student shall create, edit, complete/status-update, and delete academic and personal tasks with title, optional course, type, date, priority, notes, and attachments where supported. | Partially implemented | Create/status/relaunch/delete test covers course-linked and unlinked tasks. |
| UNI-ATT-001 | The student shall create, view, edit, and delete attendance records with a date, status, and optional note. | Partially implemented | Per-course history updates without inventing attendance. |
| UNI-ATT-002 | Portal attendance snapshots shall be clearly labelled as checked snapshots rather than asserted as a live portal integration. | Implemented design | UI distinguishes local mark from imported/snapshot data. |
| UNI-STUDY-001 | The student shall log class or self-study sessions with duration, topics, confidence, and optional linked material. | Approved design | Logged session appears in real progress totals after relaunch. |
| UNI-NOTIFY-001 | In-app notifications shall be readable, markable as read, and safe to open through valid in-app routes. | Partially implemented | Read/unread and valid action-route tests pass; broken routes do not crash. |

### 3.5 Resources and study materials

| ID | Requirement | Status | Acceptance criteria |
| --- | --- | --- | --- |
| UNI-RES-001 | The student shall add a resource as a picked document, link, typed note, PYQ, reference book, exercise, or answer and associate it with a course where appropriate. | In progress | File, valid link, and text-note cases each save and appear in the correct course. |
| UNI-RES-002 | The student shall open a local document through a supported viewer, open validated links safely, and read text notes in app. | In progress | Successful and failure-to-open cases show clear outcomes without closing the app. |
| UNI-RES-003 | The student shall rename, tag/classify, and delete a resource. | In progress | Metadata edit persists; delete removes its database record and managed local copy after confirmation. |
| UNI-RES-004 | A malformed/unsupported URI or unavailable file shall produce a recoverable error state, not a crash. | Approved design | Invalid-URI and missing-file tests retain screen stability. |

### 3.6 Search and data visibility

| ID | Requirement | Status | Acceptance criteria |
| --- | --- | --- | --- |
| UNI-SEARCH-001 | The app shall provide local search over supported stored academic entities and show a genuine no-results state. | Partially implemented | Query result links navigate to valid content; an unmatched query shows no fabricated result. |
| UNI-DATA-001 | The app shall provide a path to export/back up locally stored student data before destructive reset/cleanup features are introduced. | Approved design | Export produces a recoverable, documented local artifact and handles failure safely. |
| UNI-DATA-002 | Legacy demo-data cleanup, if offered, shall list its known generated targets and require explicit confirmation; it shall not silently remove a student profile. | Approved design | Legacy-data fixture removes only recognised demo records. |

### 3.7 Optional local AI companion

| ID | Requirement | Status | Acceptance criteria |
| --- | --- | --- | --- |
| UNI-AI-001 | The Tutor shall be optional; unavailable companion service shall never block startup or core academic workflows. | Implemented experimental / device verification pending | App works in airplane mode/with a stopped companion; Tutor offers retry/re-pair guidance within bounded timeout. |
| UNI-AI-002 | The app shall not call a cloud inference API or upload student material outside the approved local phone–laptop connection. | Implemented experimental / transport hardening pending | Network review shows no cloud endpoint; companion request test uses local pair only. |
| UNI-AI-003 | The student shall explicitly approve each material before it is copied/indexed by a companion and shall be able to revoke/remove it later. | Approved design | Permission, index, revoke, and post-revoke retrieval tests pass. |
| UNI-AI-004 | Grounded tutor answers shall disclose their selected source material and distinguish unsupported general responses from material-grounded responses. | Approved design | Test prompts display source manifest/page-or-chunk reference where available. |
| UNI-AI-005 | AI-generated dates, events, homework, exams, holidays, or tasks shall be candidates only; the app shall require student review and confirmation before a normal local record is created. | Approved design | Extraction test leaves database unchanged until the confirm action. |
| UNI-AI-006 | Personalisation shall use visible, editable learning preferences and feedback; it shall not assign an opaque academic ability label or claim to predict grades. | Approved design | Preferences can be viewed, changed, and reset; generated answer format changes without altering source facts. |

## 4. Quality requirements

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| UNI-REL-001 | The Android release distribution shall include a JavaScript bundle and start without Metro. | Inspect release APK and launch it on a clean real device. |
| UNI-REL-002 | Priority flows shall not crash: onboarding, semester, course, recurring class, one-time event, task, resource, course delete, and app relaunch. | Manual device test record covers each success/failure path. |
| UNI-REL-003 | Long-running local operations shall have visible progress and a bounded failure/retry path. | Simulated database/file/companion failure does not freeze the UI. |
| UNI-DATA-003 | Persisted data shall remain consistent across app relaunch and migration. | Test database before/after each migration; verify affected records. |
| UNI-DATA-004 | Deletion shall be scoped, confirmed, and recoverable only through an explicit backup/export mechanism. | Parent-child deletion fixture and no-unrelated-data test pass. |
| UNI-PRIV-001 | UniOS shall minimise data exposure: normal academic data remains local, selected AI context is explicit, and local AI history/indexes are removable. | Privacy controls are visible and reviewed against actual requests/storage. |
| UNI-UX-001 | Core controls shall be reachable, pressable, labelled, and understandable with accessible contrast and touch targets. | Accessibility review of priority routes; no “dead” button in test script. |
| UNI-MAINT-001 | The worktree shall pass TypeScript validation and migration/build checks appropriate to the changed area. | `npm.cmd run typecheck` and relevant Android/Expo checks pass before a release candidate. |

## 5. Out of scope for the initial production rebuild

- Cloud-hosted inference, account synchronisation, hidden analytics, or mandatory sign-in.
- Claims of guaranteed grade improvement, diagnosis, counselling, or automatic academic decisions.
- Unreviewed full-model training on personal academic data.
- Automatic direct access to a university portal unless a separate, permissioned and tested integration is approved.
- Automatic creation of schedule/task/attendance records from AI output.

## 6. Verification and traceability

Every implementation change shall reference one or more `UNI-*` requirement IDs in its test evidence. The companion evidence table maps broad product requirements to ownership and test cases; it supports this SRS but does not override it.

| Verification layer | Required evidence |
| --- | --- |
| Static | TypeScript check and lint/whitespace hygiene where available. |
| Data | Migration test, persistence/relaunch test, and targeted integrity checks. |
| UI | Pressability, validation, empty/error, and destructive-action confirmation checks on a device/emulator. |
| Release | Standalone APK contains bundle, starts past splash, and executes the priority-flow script. |
| AI | Local-only connection proof, consent/revocation test, source-grounding test, candidate-confirmation test, and hardware benchmark. |
