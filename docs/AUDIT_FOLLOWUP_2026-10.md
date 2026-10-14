# What happened to the August audit findings

The `Audit/` reports (August 2026, removed from the tree in `8b38196`, still in git
history) audited the pre-redesign app. This file records, for each finding, whether
it is fixed, replaced by something better, or still open, as of October 2026.

"Proved" means a test in `__tests__/break_it.test.ts` fails if the fix is removed.
That file runs on drizzle's expo-sqlite driver (`testing/expoSqliteHarness.ts`), so
transactions behave as on the phone.

## Fixed

| Finding | What it said | Now |
|---|---|---|
| BUG-001/006, Root cause B | "Has class today" read the legacy `calendar_events` table | Everything reads `CalendarService.getEffectiveSchedule` (snapshot, Today, Mark) |
| BUG-002/003, Root cause A | Course page showed no teacher, room or Theory/Lab | Redesigned course page; per-part attendance; `forensic_rectification.test.ts` |
| BUG-005 | Marking a multi-part course threw "ambiguous" | Marks are per occurrence id (`rec_<slot>_<date>`, `ex_<id>`), unique in the DB |
| BUG-007/008, Root cause C | Seed data used non-ISO dates | `seed.ts` deleted; no seed data in the app |
| BUG-009 | Task toggle not saved | `setTaskDone` → `TaskRepository.updateTaskStatus` |
| BUG-012 | Notifications model only | Notification repository, service and Alerts screen |
| P2-04, P4-03 | Alerts count hard-coded to 0 | `buildAlerts` derives real alerts |
| P2-05, P4-02, R0 "Attendance (Math)" | Target 75% shown as attendance | Shows `—` until a class is marked |
| P2-06, P4-04 | Dead "View All" | Old overview deleted |
| P4-05, P5-14 | Placeholder Insights | Deleted |
| P2-01, P4-01 | Semester tab duplicated the course list | Old tab deleted; it also clashed with `/semester` |
| P4-07, P5-10 | SubjectCard fetched data per card | Deleted; screens read one snapshot |
| P4-10, P5-11 | Search opened the parent course | Opens the course, task or file itself |
| P5-01 | Add Task called a missing method | Typechecks; task add/edit work |
| P5-04, P3-01, R-02 | Semester and profile semester could disagree | `activateSemester` and `addSemester` update the profile; profile save activates the semester |
| P5-06 | Failed course creation left orphan teacher/room rows | **Proved.** Transactions never rolled back (see below); fixed |
| P5-07 | Task saved for a course that doesn't exist | **Proved** refused, nothing saved |
| P5-12, P6-02, P6-03 | Deleting files/courses left files on disk | `ResourceRepository.removeFileIfUnused`; `file_cleanup.test.ts` |
| P5-13, R-03 | Dev databases committed | Removed; `.gitignore` repaired |
| P6-05 | Attendance uniqueness only in app code | DB unique index on `occurrence_id` (the old `(component_id, date)` index is gone, which is right: two lectures a day are two classes) |
| P6-07 | Deleting a semester with courses | **Proved** refused, nothing deleted |
| P6 §10 | Activating a missing semester | **Proved** no change |
| P1-10, P5-05, P3-03 (data side) | Same teacher typed twice → two rows | **Proved** case and spacing no longer matter; duplicate rows from old backups no longer block course creation |
| P1-06 | Edit hid teacher and room | Edit course has Faculty and Room (apply from today) |
| P1-07 | "Workspace" wording | User-facing text says course |

## Replaced by something better

| Finding | Now |
|---|---|
| Duplicate attendance maths (§8) | One rule, `countAttendance`; the old function is a field-renaming view of it |
| `calendar_events` legacy table (Problem 2) | Not read by any screen; schedule changes are `day_rules` + `schedule_exceptions` |
| P2-03, P3-04 screen-local state | Redesigned screens read one snapshot (`useAcademic`); the old screens that remain still load their own |
| P6-06 portal vs local precedence | Local marks are the editable record; the portal snapshot is shown separately as read-only (Attend tab), never mixed into the percentage |
| INFRA-001 local Gradle out-of-memory | Builds run on EAS in the cloud |

## Still open

| Finding | Status |
|---|---|
| P3-06, P5-03, P2-08 | Edit course cannot change parts or weekly slots. Planned in "Week setup" |
| P1-04/05, P3-03 (UI side) | Setup doesn't suggest existing teachers; there is no room field in setup (only in edit) |
| P6-08 | A database with semesters but none active: course setup explains it, other screens just show empty |
| P1-08, P1-09 | Older screens (Profile, Semesters, Search, file viewer) still use the old components and tokens |

## Found in October that the audits missed

- **No transaction ever rolled back.** All 11 `db.transaction(async …)` calls committed
  before their first `await`, so a failure part way left partial writes. A restore that
  failed after the wipe lost tasks, files and all attendance. Every DB test stubbed
  `db.transaction` as `cb => cb(db)`, so no test could see it. Fixed with `core/db/atomic.ts`
  (synchronous callbacks) and proved on the expo driver.
- Undoing "Thursday follows Friday" kept counting marks made on Friday's classes.
- Replacing the borrowed holiday left the follow rule claiming a holiday.
- Extra classes and moves onto a day off were saved and then silently vanished.
- Teacher changes ended the old teacher one day early outside India time (`new Date('YYYY-MM-DD')`).
- Four tests in `phase_b.test.ts` asserted on code written inside the test and could not fail; replaced with real ones.

## Security review, October 2026

Whole-app review (the August audit had deferred security). Each finding was checked
by a separate pass; both scored 7/10, under the review's 8/10 reporting bar, and were
fixed anyway because the fixes are small and the damage is the user's own data.

| Finding | Fix | Proved by |
|---|---|---|
| A deep link (`unios://resource/viewer?filename=…`) with an encoded `../` could hand the app's database to another app via "Open in External App" | Only `<uuid>.<ext>` names reach the viewer or `getAbsolutePath` (`core/fs/names.ts`) | `untrusted_input.test.ts` |
| A shared backup could set the avatar to `SQLite` or a resource to `.`, so changing the photo or deleting a course deleted the database or every upload | Deletes only touch names the app wrote; restores clear other paths, web avatars and non-app alert links (`sanitizeRestoredValues`) | `untrusted_input.test.ts` (fails with the old guard) |

Checked and safe: SQL (bound parameters everywhere), Gemini key (SecureStore, sent in a
header, never logged), Sentry (no default PII, replay masks all text and images), no
secrets in git history, no WebView or eval, the Samarth script never reads the password.

Still open (low): Sentry log capture could include query values from a failed write;
"Clear all data" leaves uploaded files on the phone.
