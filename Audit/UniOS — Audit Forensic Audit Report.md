# UniOS Forensic Audit Report

**Auditor:** Senior Software Forensic Auditor  
**Date:** 2026-08-17  
**Branch:** `master`  
**HEAD Commit:** `16377799cea13830c64a683b0a3d2479a4fd7f69`  
**Status:** Dirty worktree — 35 modified files, 14 untracked files  
**RULE:** No files modified during this audit.

---

## 1. Repository Statistics

| Metric | Count |
|--------|-------|
| Total files (excl node_modules/.git) | ~1310 |
| TSX source files | 82 |
| TS source files | 65 |
| JS files | 12 |
| SQL migrations | 12 |
| JSON files (config/snapshots) | 156 |
| Test files | ~4 (jest.config + __tests__/) |
| Migration snapshots | 11 |
| Assets (png/webp/jpg) | ~39 |

**Excluded:** `node_modules/`, `.git/`, `.expo/`, `android/app/build/`, `dist/`, `.tmp-*`, `scratch/`, `.idea/`, `.agent/`, `.codex/`, `stitch_assets/`, `openspec/`, `companion/`

---

## 2. Architecture Summary

```
UI Layer (app/)
  ├── (main)/_layout.tsx — Bottom tab navigator
  │     ├── home.tsx — Today's schedule via CalendarService
  │     ├── planner.tsx — Weekly timetable via CalendarService
  │     ├── tasks.tsx — Task list (direct DB query, bypasses TaskRepository)
  │     ├── more.tsx — Navigation hub
  │     ├── fab.tsx — Phantom tab for FAB interception
  │     └── [hidden: workspaces, tutor, profile, semester, resources]
  │
  ├── workspace/[id]/_layout.tsx — Course detail shell
  │     ├── index.tsx — Overview (uses useWorkspace hook)
  │     ├── attendance.tsx — Per-course attendance
  │     ├── tasks.tsx — Per-course tasks
  │     └── knowledge.tsx — Resources
  │
  ├── course/add.tsx — Course Builder (3-step wizard)
  ├── course/edit.tsx — Edit course identity
  ├── course/attendance.tsx — Cross-course attendance dashboard
  │
  └── _layout.tsx — Root: migrations, Sentry, auth gate

Domain Layer (domains/)
  ├── workspace/ — model, repository, hooks, aiService
  ├── calendar/ — model, repository, service, hooks
  ├── attendance/ — model, repository, service, hooks
  ├── task/ — model, repository, hooks
  ├── semester/ — model, repository, hooks
  ├── profile/ — model, repository, hooks, types
  ├── faculty/ — model (no repository)
  ├── venue/ — model (no repository)
  ├── resource/ — model, repository, hooks
  ├── notification/ — model (no repository/service)
  └── ai/ — model, repository

Core Layer (core/)
  ├── db/ — client, schema (re-exports), seed
  ├── context/ — ProfileContext
  ├── utils/ — attendance, time, quickAdd
  ├── ai/ — service
  ├── fs/ — (not inspected, likely file utils)
  └── settings/ — (not inspected)

Database Layer
  SQLite via expo-sqlite + drizzle-orm
  12 migrations (0000 → 0012, gap at 0009)
```

---

## 3. Domain Entity Model

| Entity | DB Table | Model File | Repository | Service | Create Flow | Read Consumers |
|--------|----------|------------|------------|---------|-------------|----------------|
| Workspace/Course | `workspaces` | workspace/model.ts | WorkspaceRepository | — | course/add.tsx → `buildCompleteWorkspace` | home, planner, workspace/[id], tasks, attendance |
| Course Component | `course_components` | workspace/model.ts | WorkspaceRepository | — | buildCompleteWorkspace | CalendarService, AttendanceService |
| Recurring Schedule | `recurring_schedules` | calendar/model.ts | — (inline in WorkspaceRepo) | CalendarService | buildCompleteWorkspace | CalendarService.getEffectiveSchedule |
| Schedule Exception | `schedule_exceptions` | calendar/model.ts | — | CalendarService | — | CalendarService.getEffectiveSchedule |
| Calendar Event | `calendar_events` | calendar/model.ts | CalendarRepository | — | CalendarRepository.createEvent, seed | useCalendar, useHasClassToday |
| Attendance | `attendance` | attendance/model.ts | AttendanceRepository | AttendanceService | workspace/[id]/attendance.tsx | workspace/[id]/attendance.tsx, course/attendance.tsx |
| Portal Attendance | `portal_attendance` | attendance/model.ts | AttendanceRepository | AttendanceService | — (read-only) | workspace/[id]/attendance.tsx, course/attendance.tsx |
| Faculty | `faculty` | faculty/model.ts | — (resolved via WorkspaceRepo) | — | resolveEntity during buildCompleteWorkspace | workspace/[id]/index.tsx |
| Venue | `venues` | venue/model.ts | — (resolved via WorkspaceRepo) | — | resolveEntity during buildCompleteWorkspace | CalendarService |
| Component Venue Assign | `component_venue_assignments` | workspace/model.ts | — (inline in WorkspaceRepo) | — | buildCompleteWorkspace | CalendarService |
| Component Faculty Assign | `component_faculty_assignments` | workspace/model.ts | — (inline in WorkspaceRepo) | — | buildCompleteWorkspace | CalendarService |
| Task | `tasks` | task/model.ts | TaskRepository | — | task/add route | tasks.tsx (direct DB), workspace/[id]/tasks.tsx |
| Resource | `resources` | resource/model.ts | ResourceRepository | — | resource/add route | workspace/[id]/knowledge.tsx |
| Semester | `semesters` | semester/model.ts | SemesterRepository | — | onboarding / semester settings | buildCompleteWorkspace, semester screen |
| Student/Profile | `students` | profile/model.ts | ProfileRepository | — | onboarding.tsx | _layout.tsx auth gate, profile screen |
| Workspace Timeline | `workspace_timeline` | workspace/model.ts | WorkspaceRepository | — | seed only | workspace/[id]/index.tsx |
| Notification | `notifications` | notification/model.ts | — | — | — | — |
| DCRUST Grading | `dcrust_grading` | semester/model.ts | — | — | seed | — |

---

## 4. Source-of-Truth Map — KEY FINDING

> [!CAUTION]
> **There are TWO PARALLEL AND DISCONNECTED scheduling systems in this codebase.**

### System A: `calendar_events` (LEGACY)
- **Written by:** `CalendarRepository.createEvent()`, `seed.ts` line 137-141
- **Read by:** `CalendarRepository.getEventsForDay()` → `useCalendar()` hook → **`useHasClassToday()`**
- **Schema:** `calendar_events` table — stores `workspace_id`, `day_of_week`, `start_time`, `end_time`

### System B: `recurring_schedules` (POST-REFACTOR, CURRENT)
- **Written by:** `WorkspaceRepository.buildCompleteWorkspace()` line 216-222
- **Read by:** `CalendarService.getEffectiveSchedule()` → `home.tsx`, `planner.tsx`
- **Schema:** `recurring_schedules` table — stores `component_id`, `day_of_week`, `start_time`, `end_time`

> [!IMPORTANT]
> ### THE CRITICAL DISCONNECT
> 
> **Course creation (add.tsx) writes to `recurring_schedules`.**
> **The Home screen and Timetable read from `recurring_schedules` via `CalendarService.getEffectiveSchedule()`.**
> **But `useHasClassToday()` reads from the LEGACY `calendar_events` table via `CalendarRepository.getEventsForDay()`.**
> 
> This means:
> 1. ✅ Home screen and Timetable correctly show courses created via the new Course Builder
> 2. ❌ The attendance "has class today" check **always reads the legacy table** which is **never written to by the new course builder**
> 3. ❌ For newly created courses, `useHasClassToday()` **always returns false** because `calendar_events` has no entries for them

---

## 5. Bug Register

### BUG-001 — P0: `useHasClassToday` reads legacy table, not `recurring_schedules`

| Field | Value |
|-------|-------|
| **Severity** | P0 — Core functionality broken |
| **Area** | Attendance / Calendar |
| **Symptom** | Attendance tab may hide the "Mark Today" card for courses created via the new Course Builder |
| **Root Cause** | [useHasClassToday](file:///c:/Users/Harsh/OneDrive/Desktop/AI_Lab/UniOS/domains/calendar/hooks.ts#L34-L62) calls `CalendarRepository.getEventsForDay()` which queries `calendar_events`, not `recurring_schedules`. The Course Builder writes to `recurring_schedules` only. |
| **Evidence** | `calendar/hooks.ts:44` → `CalendarRepository.getEventsForDay(dayOfWeek, specificDateStr)` → `calendar/repository.ts:10-34` → queries `calendarEvents` table. Course Builder `workspace/repository.ts:216` → inserts into `recurringSchedules`. No code writes to `calendarEvents` for new courses. |
| **Data Impact** | Attendance marking UI hidden for new courses |
| **User Impact** | User cannot mark attendance on days they have class |
| **Fix Complexity** | Medium — requires `useHasClassToday` to use `CalendarService.getEffectiveSchedule` or equivalent |

---

### BUG-002 — P0: Course Detail Overview does not show components, venue, or schedule

| Field | Value |
|-------|-------|
| **Severity** | P0 — Critical data not displayed |
| **Area** | Workspace Overview |
| **Symptom** | Course detail shows "No instructor set", no venue, no schedule, no component breakdown |
| **Root Cause** | [WorkspaceRepository.getWorkspaceById](file:///c:/Users/Harsh/OneDrive/Desktop/AI_Lab/UniOS/domains/workspace/repository.ts#L20-L31) LEFT JOINs `workspaces` → `faculty` via `defaultFacultyId`. But the Course Builder stores faculty at the **component level** (`course_components.faculty_id` and `component_faculty_assignments`), NOT at `workspaces.default_faculty_id`. The builder sets `default_faculty_id = null` on the workspace row. |
| **Evidence** | `workspace/repository.ts:26` joins on `workspaces.defaultFacultyId` which is never set by `buildCompleteWorkspace()`. `buildCompleteWorkspace():172-179` creates workspace with no `defaultFacultyId`. Faculty is set on `courseComponents` (line 192) and `componentFacultyAssignments` (line 207). |
| **Secondary** | The overview screen ([workspace/[id]/index.tsx:18](file:///c:/Users/Harsh/OneDrive/Desktop/AI_Lab/UniOS/app/workspace/%5Bid%5D/index.tsx#L18)) reads `workspaceData?.faculty?.name` from this JOIN — always null for new courses. No venue is queried at all. |
| **Data Impact** | Faculty/venue data exists in DB but is inaccessible from the overview |
| **Fix Complexity** | Medium — overview needs to query `courseComponents` + `componentFacultyAssignments` + `componentVenueAssignments` |

---

### BUG-003 — P0: Course Detail does not display components (Theory/Lab/Tutorial distinction)

| Field | Value |
|-------|-------|
| **Severity** | P0 |
| **Area** | Workspace Overview |
| **Symptom** | User configures Theory + Lab, but course detail shows no component information |
| **Root Cause** | [workspace/[id]/index.tsx](file:///c:/Users/Harsh/OneDrive/Desktop/AI_Lab/UniOS/app/workspace/%5Bid%5D/index.tsx) never queries `course_components`. The `useWorkspace` hook only fetches the workspace row + faculty. Components, schedules, and venue assignments are completely absent from the detail view. |
| **Evidence** | `useWorkspace()` calls `WorkspaceRepository.getWorkspaceById()` — returns `{ workspace, faculty }`. No components query exists. |
| **Data Impact** | Lab components are persisted but invisible |

---

### BUG-004 — P1: Edit Course reads non-existent workspace fields

| Field | Value |
|-------|-------|
| **Severity** | P1 |
| **Area** | Course Edit |
| **Symptom** | Edit screen shows empty faculty/venue even when they exist at component level. Refers to `workspace.type` which was removed in migration 0008. |
| **Root Cause** | [course/edit.tsx:58-60](file:///c:/Users/Harsh/OneDrive/Desktop/AI_Lab/UniOS/app/course/edit.tsx#L57-L60) reads `workspaceData.venue?.name` — but `getWorkspaceById` never JOINs venues. Also reads `workspace.type` — column removed in migration 0008. |
| **Evidence** | `workspace/repository.ts:20-31` — no venue in SELECT. Migration 0008 line 185: "Drop: type, faculty_id, venue_id". Edit.tsx line 60: `workspace.type as any` — accessing deleted column. |

---

### BUG-005 — P1: Attendance marking for multi-component courses throws ambiguity error

| Field | Value |
|-------|-------|
| **Severity** | P1 |
| **Area** | Attendance |
| **Symptom** | When a course has Theory + Lab, calling `markAttendance(workspaceId, date, status)` without `componentId` throws "Ambiguous attendance marking" |
| **Root Cause** | [AttendanceRepository.markAttendance](file:///c:/Users/Harsh/OneDrive/Desktop/AI_Lab/UniOS/domains/attendance/repository.ts#L32-L49) line 47 throws when `components.length > 1` and no `componentId` is provided. The [attendance UI](file:///c:/Users/Harsh/OneDrive/Desktop/AI_Lab/UniOS/app/workspace/%5Bid%5D/attendance.tsx#L39) calls `AttendanceRepository.markAttendance(workspaceId, todayStr, status)` — no componentId. |
| **Evidence** | `attendance/repository.ts:47` — `throw new Error("Ambiguous attendance marking: workspace has multiple components. A specific componentId is required.")`. `attendance.tsx:39` — passes no componentId. |
| **User Impact** | **Cannot mark attendance for any course with Theory + Lab (or Theory + Tutorial)** |
| **Fix Complexity** | Medium — UI needs component selector, or smart resolution based on today's schedule |

---

### BUG-006 — P1: `useHasClassToday` uses wrong data source (duplicate of BUG-001, attendance-specific manifestation)

Covered by BUG-001. The attendance screen at line 142 `hasClass !== false` gates the entire "Today's Quick Mark" section. Since `useHasClassToday` queries the empty legacy table, `hasClass` returns `false` and the marking UI is **completely hidden** even when the user has a class today.

---

### BUG-007 — P2: Seed data uses human-readable dates, not ISO dates

| Field | Value |
|-------|-------|
| **Severity** | P2 |
| **Area** | Seed Data |
| **Symptom** | Seed data attendance dates are "Mon, 10th" not ISO format; task dates are "Tomorrow, 11:59 PM" |
| **Root Cause** | [seed.ts:99-103](file:///c:/Users/Harsh/OneDrive/Desktop/AI_Lab/UniOS/core/db/seed.ts#L99-L103) and [seed.ts:124-127](file:///c:/Users/Harsh/OneDrive/Desktop/AI_Lab/UniOS/core/db/seed.ts#L124-L127) use free-text strings for dates |
| **Data Impact** | Attendance records from seed data never match ISO date comparisons. Tasks from seed data won't filter correctly. |

---

### BUG-008 — P2: Seed data writes to legacy `calendarEvents`, not `recurringSchedules`

| Field | Value |
|-------|-------|
| **Severity** | P2 |
| **Area** | Seed Data |
| **Symptom** | Seed-created courses appear in the legacy `calendar_events` table but may not appear correctly in the timetable |
| **Root Cause** | [seed.ts:137-141](file:///c:/Users/Harsh/OneDrive/Desktop/AI_Lab/UniOS/core/db/seed.ts#L137-L141) inserts into `calendarEvents`. The new timetable (`CalendarService.getEffectiveSchedule`) reads from `recurringSchedules`. |
| **Evidence** | Seed courses lack `recurringSchedules` entries; new courses lack `calendarEvents` entries. The two sets are mutually invisible to each other's consumers. |

---

### BUG-009 — P2: Task toggle is optimistic-only, never persisted

| Field | Value |
|-------|-------|
| **Severity** | P2 |
| **Area** | Tasks |
| **Symptom** | Checking/unchecking a task on the Tasks screen does not persist |
| **Root Cause** | [tasks.tsx:78-83](file:///c:/Users/Harsh/OneDrive/Desktop/AI_Lab/UniOS/app/%28main%29/tasks.tsx#L78-L83) — `toggleTask` updates local state only. Comment says "In a real app, we would await TaskRepository.updateTask". No DB call. |
| **User Impact** | Task status resets on screen re-entry |

---

### BUG-010 — P2: Tasks screen bypasses TaskRepository, queries DB directly

| Field | Value |
|-------|-------|
| **Severity** | P2 |
| **Area** | Architecture |
| **Symptom** | Tasks screen uses `db.select(...).from(tasks).leftJoin(workspaces...)` directly instead of using TaskRepository |
| **Root Cause** | [tasks.tsx:34-46](file:///c:/Users/Harsh/OneDrive/Desktop/AI_Lab/UniOS/app/%28main%29/tasks.tsx#L34-L46) — raw Drizzle query, bypassing repository layer |
| **Impact** | Business logic (status normalization, workspace fallback) is duplicated in the screen |

---

### BUG-011 — P2: Attendance percentage on course/attendance.tsx aggregates may include seed garbage data

The portal attendance seed data at [seed.ts:116-121](file:///c:/Users/Harsh/OneDrive/Desktop/AI_Lab/UniOS/core/db/seed.ts#L116-L121) has `checkedDate: 'Today'` (not ISO date). The attendance calculation doesn't filter by date validity, so this data pollutes aggregates.

---

### BUG-012 — P2: Notification model exists but has no repository, service, or UI

| Field | Value |
|-------|-------|
| **Severity** | P2 |
| **Area** | Notifications |
| **Symptom** | `notifications.tsx` exists as a route but notification model has no read/write infrastructure |
| **Status** | PLACEHOLDER — functionality completely missing |

---

### BUG-013 — P3: Migration gap — index 9 missing (0009)

The journal skips from `idx: 8` (tag `0008_academic_refactor`) to `idx: 9` (tag `0010_abandoned_spencer_smythe`). There is no `0009` migration file. The `migrations.js` names the import `m0009` for the `0010_*` file. This is cosmetic but confusing — could cause issues if a migration `0009` is later created.

---

### BUG-014 — P3: `recurring_schedules` model has `effectiveStartDate`/`effectiveEndDate` not present in migration 0008

The Drizzle model ([calendar/model.ts:32-33](file:///c:/Users/Harsh/OneDrive/Desktop/AI_Lab/UniOS/domains/calendar/model.ts#L32-L33)) defines `effectiveStartDate` and `effectiveEndDate` columns. But migration 0008 ([line 44-53](file:///c:/Users/Harsh/OneDrive/Desktop/AI_Lab/UniOS/drizzle/0008_academic_refactor.sql#L44-L53)) does NOT include these columns. They may have been added in a later migration (0010 or 0011) — needs verification. If not, the columns exist in the Drizzle model but not the DB schema.

---

## 6. Root-Cause Graph

```
BUG-005: Cannot mark attendance for multi-component courses
    ↑ UI passes no componentId
    ↑
BUG-003: Course detail doesn't show components
    ↑ useWorkspace doesn't query components
    ↑
BUG-002: Course detail shows "No instructor set"
    ↑ getWorkspaceById JOINs on defaultFacultyId (null)
    ↑
ROOT CAUSE A: The workspace/repository query layer was NOT updated
    after migration 0008 (academic refactor). The refactor moved
    faculty/venue/type from workspaces to course_components, but
    the READ paths still expect the OLD workspace-level fields.

─────────────────────────────────────────────────────────────

BUG-001: useHasClassToday reads empty legacy table
    ↑
BUG-006: Attendance "Mark Today" card hidden
    ↑
ROOT CAUSE B: Two parallel scheduling systems (calendar_events vs
    recurring_schedules) coexist. The new builder writes to the new
    system, but useHasClassToday still reads the old one.

─────────────────────────────────────────────────────────────

BUG-008: Seed writes to legacy calendarEvents
BUG-007: Seed uses non-ISO dates
    ↑
ROOT CAUSE C: Seed data was never updated after migration 0008.
    It still uses the pre-refactor data model.
```

### Summary: There are 3 root causes, not 14 separate bugs.

| Root Cause | Bugs Resolved | Description |
|------------|---------------|-------------|
| **A: Read-path not updated post-refactor** | BUG-002, BUG-003, BUG-004, BUG-005 | Migration 0008 restructured the data model, but `getWorkspaceById`, `useWorkspace`, course detail UI, and attendance marking were never updated to read from `course_components` / `component_*_assignments` |
| **B: Dual scheduling system** | BUG-001, BUG-006 | `CalendarRepository` + `useCalendar` + `useHasClassToday` read `calendar_events` (legacy). `CalendarService` + home + timetable read `recurring_schedules` (new). Course Builder writes only to new. |
| **C: Seed data stale** | BUG-007, BUG-008, BUG-011 | `seed.ts` uses pre-refactor tables and non-ISO date strings |

---

## 7. Data-Lineage Analysis: Course Creation End-to-End

### What happens when a user creates a course with Theory + Lab:

| Step | Field | UI Location | State Variable | Persisted? | DB Location | Read Back? |
|------|-------|-------------|----------------|------------|-------------|------------|
| 1 | Course Name | add.tsx:426-432 | `name` | ✅ | `workspaces.name` | ✅ via getAllWorkspaces, getWorkspaceById |
| 1 | Course Code | add.tsx:438-444 | `code` | ✅ | `workspaces.code` | ✅ |
| 1 | Credits | add.tsx:448-455 | `credits` | ✅ | `workspaces.credits` | ✅ |
| 1 | Color | add.tsx:460-470 | `selectedColor` | ✅ | `workspaces.color` | ✅ |
| 1 | Icon | add.tsx:472-489 | `icon` | ✅ | `workspaces.icon` | ❌ never read by workspace detail |
| 2 | Template (theory_only/theory_lab/theory_tutorial) | add.tsx:508-527 | `template` | ❌ NOT persisted | — | — |
| 2 | Theory Faculty | add.tsx:548-554 | `components[0].facultyName` | ✅ | `faculty.name` → `course_components.faculty_id` + `component_faculty_assignments` | ❌ NOT read by workspace detail |
| 2 | Theory Venue | add.tsx:558-564 | `components[0].venueName` | ✅ | `venues.name` → `component_venue_assignments` | ❌ NOT read by workspace detail; ✅ read by CalendarService |
| 2 | Lab Faculty | Same | `components[1].facultyName` | ✅ | Same pattern | ❌ |
| 2 | Lab Venue | Same | `components[1].venueName` | ✅ | Same pattern | ❌ workspace detail; ✅ CalendarService |
| 2 | Session Day | add.tsx:581-586 | `sessions[n].dayOfWeek` | ✅ | `recurring_schedules.day_of_week` | ✅ via CalendarService (home/timetable) |
| 2 | Session Start Time | add.tsx:591-620 | `sessions[n].startTime` | ✅ | `recurring_schedules.start_time` | ✅ |
| 2 | Session End Time | Calculated | `calculateEndTime()` | ✅ | `recurring_schedules.end_time` | ✅ |
| 3 | Review + Confirm | add.tsx:356-387 | — | → `buildCompleteWorkspace()` | All above | — |

### WHERE DATA DISAPPEARS:

**Faculty:** Persisted at component level → Never read by workspace overview (reads `workspaces.default_faculty_id` which is null)

**Venue:** Persisted at `component_venue_assignments` → Never read by workspace overview (no venue query at all). Read correctly by CalendarService for timetable display.

**Components (Theory/Lab distinction):** Persisted in `course_components` → Never read by workspace overview. Correctly read by CalendarService.

**Target Attendance:** Persisted at workspace level → Read correctly by attendance screen from `workspaceData?.workspace?.targetAttendance`.

---

## 8. Duplicate Logic / Conflicting Business Rules

| Concept | Location A | Location B | Conflict? |
|---------|-----------|-----------|-----------|
| "Due Soon" | TaskRepository.getTasksDueSoon: `dueDate <= today` | tasks.tsx:70: `dueDate <= today` | No conflict — same logic, but duplicated |
| Attendance calculation | core/utils/attendance.ts: `calculateAttendanceMetrics()` | attendance/service.ts: `getLocalAttendanceState()` | **YES** — service counts `present + exempt` as attended. Utility also counts `present + exempt`. Same logic but **duplicated in two files**. Service hardcodes it; utility is the abstracted version. |
| Faculty resolution | workspace/repository.ts:67-87 `resolveEntity` | No other location | OK — single implementation |
| Venue display | CalendarService uses `componentVenueAssignments` | workspace/[id]/index.tsx: no venue query | **Architectural gap** — not a conflict, but a missing query |
| Component duration | Course Builder hardcodes Theory=60, Lab=120 | workspace/repository.ts:136-138 validates same | Duplicated validation — OK but fragile |
| "Completed" status normalization | tasks.tsx:51: `status === 'completed' ? 'completed' : 'pending'` | TaskRepository: no normalization | UI-specific transform, not a conflict |

---

## 9. Mock / Demo / Placeholder Audit

| Location | Content | Classification | Appropriate? |
|----------|---------|----------------|-------------|
| seed.ts:99 | `dueDate: 'Tomorrow, 11:59 PM'` | **DEMO — invalid** | ❌ Non-ISO dates will break all date comparisons |
| seed.ts:117 | `checkedDate: 'Today'` | **DEMO — invalid** | ❌ Non-ISO date |
| seed.ts:124-127 | `date: 'Mon, 10th'` | **DEMO — invalid** | ❌ |
| home.tsx:45 | `const mockExams = 0` | **PLACEHOLDER** | ⚠️ Hardcoded exam count — no exam tracking exists |
| tasks.tsx:79 | Comment: "In a real app, we would await TaskRepository.updateTask" | **PLACEHOLDER** | ❌ Task status toggle is not persisted |
| course/attendance.tsx:92 | `Last synced: 12 Aug 2026` | **HARDCODED** | ❌ Not from DB; misleading |
| workspace/[id]/index.tsx:28 | `trend="Tracking disabled"` | **HARDCODED** | ⚠️ Always shows this regardless of actual state |

---

## 10. Feature Completeness Matrix

| Feature | Status |
|---------|--------|
| Course creation (full wizard) | ✅ IMPLEMENTED + WORKING |
| Course listing | ✅ IMPLEMENTED + WORKING |
| Course detail overview | ⚠️ IMPLEMENTED + BROKEN (no components/faculty/venue) |
| Course editing | ⚠️ PARTIALLY IMPLEMENTED (identity only, not components/schedule) |
| Course deletion | ✅ IMPLEMENTED + WORKING |
| Timetable (weekly view) | ✅ IMPLEMENTED + WORKING (for new courses) |
| Home today schedule | ✅ IMPLEMENTED + WORKING (for new courses) |
| Attendance marking (single component) | ✅ IMPLEMENTED + WORKING |
| Attendance marking (multi-component) | ❌ IMPLEMENTED + BROKEN (ambiguity error) |
| Attendance "has class today" check | ❌ IMPLEMENTED + BROKEN (reads wrong table) |
| Attendance dashboard (cross-course) | ✅ IMPLEMENTED + WORKING |
| Portal attendance sync | 🟡 UI ONLY (no actual sync mechanism) |
| Task creation | ✅ IMPLEMENTED + WORKING |
| Task completion toggle | ❌ UI ONLY (not persisted) |
| Task editing | 🟡 PARTIALLY — repository exists, no edit UI |
| Resource upload/attach | ✅ IMPLEMENTED + WORKING |
| Profile/Onboarding | ✅ IMPLEMENTED + WORKING |
| Semester management | ✅ IMPLEMENTED + WORKING |
| Schedule exceptions (cancel/move/extra) | 🟡 DOMAIN ONLY — no UI to create exceptions |
| Historical faculty/venue changes | 🟡 DOMAIN ONLY — repository methods exist, no UI |
| Notifications | ❌ PLACEHOLDER — model only |
| Search | 🟡 PARTIALLY — route exists, unknown state |
| AI Tutor | 🟡 UNKNOWN — route + aiService exist |
| Academic Weather | ✅ IMPLEMENTED + WORKING |

---

## 11. Database / Migration Audit

| DB Table | Model | Final Migration | Writers | Readers | FK | Conflict |
|----------|-------|----------------|---------|---------|----|----|
| `workspaces` | workspace/model.ts | 0008 rebuilt | buildCompleteWorkspace, updateCourseIdentity, seed | getAllWorkspaces, getWorkspaceById, CalendarService, AttendanceService, tasks screen | semester_id→semesters, default_faculty_id→faculty | `default_faculty_id` never set by builder |
| `course_components` | workspace/model.ts | 0008 created | buildCompleteWorkspace, seed | CalendarService, AttendanceService, AttendanceRepository | workspace_id→workspaces, faculty_id→faculty | ✅ OK |
| `recurring_schedules` | calendar/model.ts | 0008 created | buildCompleteWorkspace | CalendarService | component_id→course_components | Model has `effectiveStartDate`/`effectiveEndDate` — verify in DB |
| `schedule_exceptions` | calendar/model.ts | 0008 created | (none in production) | CalendarService | component_id→course_components, recurring_schedule_id→recurring_schedules | No writer UI |
| `calendar_events` | calendar/model.ts | 0008 rebuilt | CalendarRepository.createEvent, seed | CalendarRepository.getEventsForDay, useHasClassToday | workspace_id→workspaces | **LEGACY — orphaned from new creation flow** |
| `attendance` | attendance/model.ts | 0008 rebuilt | AttendanceRepository.markAttendance, AttendanceService.markLocalAttendance, seed | AttendanceRepository.getAttendanceHistory, AttendanceService.getLocalAttendanceState | component_id→course_components | ✅ OK |
| `portal_attendance` | attendance/model.ts | 0008 rebuilt | seed only | AttendanceRepository.getPortalAttendance, AttendanceService.getPortalAttendanceState | workspace_id→workspaces, component_id→course_components | No production writer |
| `component_venue_assignments` | workspace/model.ts | 0008 created | buildCompleteWorkspace, changeHistoricalVenue | CalendarService | component_id→course_components, venue_id→venues | ✅ OK |
| `component_faculty_assignments` | workspace/model.ts | 0008 created | buildCompleteWorkspace, changeHistoricalFaculty | CalendarService | component_id→course_components, faculty_id→faculty | ✅ OK |
| `tasks` | task/model.ts | 0000 (original) | TaskRepository.createTask, seed | TaskRepository, tasks.tsx (direct) | workspace_id→workspaces | ✅ OK |
| `faculty` | faculty/model.ts | 0000 (original) | resolveEntity (auto-create), seed | getWorkspaceById, CalendarService | — | ✅ OK |
| `venues` | venue/model.ts | 0000 (original) | resolveEntity (auto-create), seed | CalendarService, CalendarRepository | — | ✅ OK |
| `workspace_timeline` | workspace/model.ts | 0000 (original) | seed only | workspace/[id]/index.tsx | workspace_id→workspaces | No production writer |

---

## 12. Dead / Unreachable Code

| Item | Location | Evidence |
|------|----------|---------|
| `calendarEvents` writers for new courses | CalendarRepository.createEvent | No UI calls this for workspace-linked events after refactor |
| `useCalendar` hook | calendar/hooks.ts:6-32 | Used by useHasClassToday but not by home or timetable (they use CalendarService). Hook reads legacy table. |
| `useHeroCardContext` hook | calendar/hooks.ts:64-97 | Appears unused — no import found in home.tsx or any screen |
| `AttendanceService.markLocalAttendance` | attendance/service.ts:126-134 | UI calls `AttendanceRepository.markAttendance` directly, not this method |
| `AttendanceService.updatePortalAttendance` | attendance/service.ts:142-144 | Always throws — by design |
| `notification` model | notification/model.ts | No repository, no service, no screen that reads/writes |
| `workspace/[id]/insights.tsx` | workspace route | Exists but not in WORKSPACE_TABS — unreachable via tab navigation |

---

## 13. Critical Architectural Problems

### Problem 1: Post-Refactor Read Path Gap
Migration 0008 correctly restructured the database from a flat `workspaces` model to a normalized `workspaces → course_components → recurring_schedules` model. However, the read-side code (repositories, hooks, and UI) was **only partially updated**:
- CalendarService ✅ was updated to read the new model
- WorkspaceRepository ❌ still reads old fields
- useHasClassToday ❌ still reads the legacy table
- Workspace detail UI ❌ never queries components

### Problem 2: Legacy Table Not Decommissioned
`calendar_events` should have been deprecated after migration 0008 migrated its data to `recurring_schedules`. Instead, it remains active with readers (`CalendarRepository`, `useCalendar`, `useHasClassToday`) that are consumed by the attendance system. This creates a situation where the timetable works but attendance doesn't.

### Problem 3: No Service Layer for Workspace
There is no `WorkspaceService` that provides a unified view of a workspace + its components + schedules + assignments. The repository returns raw DB rows, and each screen must independently assemble the full picture — leading to inconsistencies.

---

## 14. Security — DEFERRED

Security audit intentionally deferred until functional/data-integrity audit is completed. The Sentry DSN is committed to source (noted but not addressed).

---

## 15. Implementation Roadmap

### Phase 1: Unify the Scheduling Data Source (Resolves Root Cause B)

**Bugs resolved:** BUG-001, BUG-006  
**Files:** `domains/calendar/hooks.ts`, `domains/calendar/repository.ts`  
**Action:**
1. Rewrite `useHasClassToday` to use `CalendarService.getEffectiveSchedule()` for the current date, filtered by workspaceId
2. Deprecate `CalendarRepository.getEventsForDay()` for workspace-linked schedule reads
3. Keep `calendar_events` table for truly ad-hoc/external events only

**Migration required?** No  
**Tests required:** Unit test for `useHasClassToday` with courses that only have `recurring_schedules` entries  
**Acceptance criteria:** Attendance "Mark Today" card appears for courses created via Course Builder

---

### Phase 2: Complete the Workspace Read Path (Resolves Root Cause A)

**Bugs resolved:** BUG-002, BUG-003, BUG-004, BUG-005  
**Files:** `domains/workspace/repository.ts`, `domains/workspace/hooks.ts`, `app/workspace/[id]/index.tsx`, `app/workspace/[id]/attendance.tsx`, `app/course/edit.tsx`  
**Action:**
1. Create `WorkspaceRepository.getCompleteWorkspace(id)` that returns workspace + components + active faculty/venue assignments + schedules
2. Update `useWorkspace` hook to use this method
3. Update workspace overview to display component breakdown, faculty per component, venue per component
4. Update attendance screen to pass the correct `componentId` (resolve from today's schedule or present a selector)
5. Fix `course/edit.tsx` to not reference deleted `workspace.type` field

**Migration required?** No  
**Tests required:** Integration test for `getCompleteWorkspace`. Test attendance marking for multi-component courses.  
**Acceptance criteria:** Course detail shows faculty, venue, and component breakdown. Attendance can be marked for Theory+Lab courses.

---

### Phase 3: Fix Seed Data (Resolves Root Cause C)

**Bugs resolved:** BUG-007, BUG-008, BUG-011  
**Files:** `core/db/seed.ts`  
**Action:**
1. Replace all human-readable dates with ISO dates
2. Create seed courses using `buildCompleteWorkspace` or write to both `course_components` + `recurring_schedules`
3. Remove seed data for `calendarEvents` or add matching `recurringSchedules`

**Migration required?** No  
**Acceptance criteria:** Seed data produces valid timetable and attendance states

---

### Phase 4: Task Status Persistence

**Bugs resolved:** BUG-009, BUG-010  
**Files:** `app/(main)/tasks.tsx`, `domains/task/repository.ts`  
**Action:**
1. Replace direct DB query with `TaskRepository` method
2. Implement actual status toggle via `TaskRepository.updateTask`

---

### Phase 5: Feature Completion

- Schedule exception UI (cancel/move/extra class)
- Historical faculty/venue change UI
- Workspace timeline production writes
- Notification system
- `insights.tsx` either connect or remove

---

### Phase 6: Cleanup

- Deprecate/remove `CalendarRepository.getEventsForDay` for schedule reads
- Remove `useCalendar` hook if fully replaced
- Remove dead `useHeroCardContext` if unused
- Clean up hardcoded strings in `course/attendance.tsx`

---

> [!IMPORTANT]
> **The critical insight of this audit is:** The application underwent a significant architectural refactor (migration 0008) that correctly restructured the database, but the **read-side code was only partially updated**. This created a split-brain scenario where writes go to the new model but reads come from the old model (or incomplete views of the new model). This single root cause explains why courses appear to save correctly but downstream screens show missing or incorrect data.
