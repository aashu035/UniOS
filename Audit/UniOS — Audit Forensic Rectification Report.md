# Phase B.5 Forensic Rectification Verification Audit Report

**Report Version:** 2.0 (Forensic Rectification & End-to-End Verification)  
**Date:** 2026-08-17  
**Branch:** `master`  
**Test Runner:** Jest 29.7 / TypeScript 6.0 / Node.js with in-memory SQLite (better-sqlite3)  
**Total Automated Tests:** 24 Passed, 0 Failed, 5 Suites  

---

## 1. Executive Summary

This report establishes **end-to-end data-lineage verification** for the three architectural root causes identified during the initial physical-device forensic audit. 

Rather than relying on isolated domain invariants or synthetic mocks alone, this verification suite creates complete entities through production transaction paths, commits them to a real SQLite database, inspects raw database rows directly, and reads them back through the production service and repository query layers.

---

## 2. Root-Cause Rectification Matrix

| Forensic Root Cause | Original Physical Device Symptom | Codebase Fix | Automated Verification | Status |
|---|---|---|---|---|
| **Root Cause A: Post-0008 Read Path Disconnect** | Course detail displayed "No instructor set", no venue, and no Theory/Lab distinction because `getWorkspaceById` only LEFT JOINed the removed `workspaces.default_faculty_id` column. | Created `WorkspaceRepository.getCompleteWorkspace()` querying `workspaces`, `course_components`, `component_venue_assignments`, `component_faculty_assignments`, and `recurring_schedules`. Fixed date string normalization (`split('T')[0]`) in resolvers. | **Test 1 & Test 2:** Directly created "Embedded System" (Theory + Lab) and verified all 7 DB tables and complete read-back with active faculty ("Dr. RD"), venue ("JCB 213"), Lab faculty ("Dr. XYZ"), and schedules. | **RECTIFIED & VERIFIED** |
| **Root Cause B: Dual Scheduling Split-Brain** | Attendance screen hid "Mark Today" card because `useHasClassToday` read from the legacy `calendar_events` table (never written to by Course Builder). | Re-pointed `useHasClassToday` to `CalendarService.getEffectiveSchedule()` which queries `recurring_schedules` + `schedule_exceptions`. | **Test 3 & Test 4:** Verified 2 courses on Monday both appear in timetable; verified `hasClassToday` returns `true` on Mon/Wed and `false` on Tue. | **RECTIFIED & VERIFIED** |
| **Root Cause C: Stale Seed Data Model** | Seed data used non-ISO strings (`'Tomorrow, 11:59 PM'`, `'Today'`) and only populated `calendar_events`, causing erratic timetable and attendance percentages. | Updated `core/db/seed.ts` to write to `course_components`, `component_venue_assignments`, `component_faculty_assignments`, `recurring_schedules`, and valid ISO dates for tasks and attendance. | Seed file updated and verified against Drizzle schema and typecheck. | **RECTIFIED & VERIFIED** |

---

## 3. Detailed Verification Results (24/24 Passing Tests)

### Suite 1: `__tests__/forensic_rectification.test.ts` (8 Tests)
1. **Test 1 — Course Persistence:**
   - Payload: "Embedded System", "ESECE301D", 4 credits, Theory (Dr. RD, JCB 213, Mon 09:00–10:00), Lab (Dr. XYZ, Lab X, Wed 14:00–16:00).
   - Direct SQL Assertions: Verified raw rows in `workspaces`, `course_components`, `faculty`, `venues`, `component_faculty_assignments`, `component_venue_assignments`, and `recurring_schedules`.
2. **Test 2 — Course Read-Back (`getCompleteWorkspace`):**
   - Asserted `faculty.name === "Dr. RD"`, `venue.name === "JCB 213"`.
   - Asserted `components[0]` (Theory: Dr. RD, JCB 213, 60m, Mon 09:00).
   - Asserted `components[1]` (Lab: Dr. XYZ, Lab X, 120m, Wed 14:00).
3. **Test 3 — Timetable Integrity (`CalendarService.getEffectiveSchedule`):**
   - Created Course A (Embedded System) and Course B (Computer Networks) on Monday.
   - Asserted BOTH courses appear on Monday with their respective venues, times, and faculty.
4. **Test 4 — Attendance Detection (`hasClassToday`):**
   - Course with recurring schedule: Monday -> `true`, Tuesday -> `false`, Wednesday -> `true`.
5. **Test 5 — Attendance Marking & Calculation:**
   - Marked 'present' -> Database row verified -> `metrics.percentage === 100%` (1/1).
   - Marked 'absent' on second date -> Database row verified -> `metrics.percentage === 50%` (1/2).
6. **Test 6 — Multi-Component Attendance Resolution:**
   - Marked attendance on Lab day without passing `componentId` -> Automatically resolved to Lab component without throwing `Ambiguous attendance marking`.
7. **Test 7 — Target vs Actual Attendance Differentiation:**
   - 0 records -> `targetAttendance === 75%`, `percentage === null`, `hasData === false` (UI renders "No Data" / "-" rather than 75%).
   - 1 present record -> `targetAttendance === 75%`, `percentage === 100%`.
8. **Test 8 — Task Persistence & Toggle:**
   - Created task -> Toggled status to `completed` via `TaskRepository.updateTaskStatus` -> Verified persisted DB row and `getAllTasksWithWorkspaces`.

### Suite 2: `__tests__/phase_b.test.ts` (8 Tests)
- Transaction atomicity on unconfirmed form payloads.
- Entity normalization (create / reuse / ambiguous-match rejection).
- Historical faculty assignment resolution.
- Exception venue and faculty overrides.
- Same-component exception isolation.
- Attendance cancellation exclusion.
- Workspace context FAB isolation.
- Attendance duty/exempt semantics (`(present + exempt) / (present + absent + exempt)`).

### Suite 3: `core/utils/attendance.test.ts` (2 Tests)
- Duty leave / medical freeze calculation semantics.
- Null percentage handling for empty records.

### Suite 4: `core/utils/quickAdd.test.ts` (3 Tests)
- Quick add parsing for types, locations, and normalized `HH:MM AM/PM` formats.

### Suite 5: `core/utils/time.test.ts` (3 Tests)
- AM/PM time comparisons and validation.

---

## 4. TypeScript & Lint Verification
- `npx tsc --noEmit`: **0 errors (Clean compilation)**.
- All domain repositories, hooks, and UI screens conform to Drizzle ORM schema types.

---

## 5. Conclusion

The Phase B domain invariants, database read-paths, and scheduling unifications are **verified end-to-end with automated test proof**. The application data pipeline now operates on a single, unified source of truth across Course Setup, Timetable, Workspace Detail, and Attendance Tracking.
