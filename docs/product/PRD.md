# Product Requirements Document (PRD) - UniOS

**Last reconciled with the code:** 2026-10-17, from commit `b779d2d`.

## 1. Product vision

UniOS is a private academic organiser for university students. It stores a student's semesters, timetable, attendance, tasks and study files on the phone. It tells the student, every day, what is next and where they stand in each subject.

The first users are B.Tech students at DCRUST, Murthal. Attendance follows the DCRUST B.Tech Ordinance 2024-25, clause 9.

## 2. Target users

| User | Need |
| --- | --- |
| DCRUST B.Tech student | Stay at or above 75% attendance in each subject, and know how many classes they can miss. |
| Any university student | Keep a timetable, tasks and course files in one place, without an account. |
| Privacy-conscious student | Keep academic records on the phone, not on someone else's server. |

## 3. Key user journeys

| Journey | Status |
| --- | --- |
| Onboarding: name, branch, semester | Implemented |
| Add a course and its weekly classes by hand | Implemented |
| Add courses from a timetable photo with the optional AI scan | Implemented (needs the student's own Gemini key) |
| Mark attendance for each class; see the skip budget | Implemented |
| Change the schedule: cancel, move, extra class, day off, follow another weekday | Implemented |
| Track tasks with or without a course | Implemented |
| Add files, photos, links and notes to a course; open them in app | Implemented |
| Back up to one file and restore | Implemented (database rows only, not files) |
| See a portal attendance snapshot next to the local log | Partial: display only, no way to enter a snapshot |
| Edit an existing course's weekly slots | Planned (audit item OLD-01) |
| Local AI tutor on a paired laptop | Removed (commit `8b38196`, 2026-10-14) |

## 4. Release scope

### Current: core academic organiser (Android)

- All academic data in SQLite on the phone.
- Courses, timetable, schedule changes, attendance, tasks, files, notes, search, backup.
- Optional Gemini timetable scan with the student's own key.

### Next (not started)

- Device test record for the main flows.
- Edit weekly slots of an existing course.
- Entry of portal attendance by the student.

The laptop AI tutor is no longer in the plan. It needs a new owner decision before any work.

## 5. Non-goals

- **Cloud sync and accounts.** UniOS does not sync data to a server.
- **Social features.** No sharing of schedules or tasks between students, except a backup file that the student shares.
- **Automatic portal login.** UniOS never asks for, stores or logs a portal password.

## 6. External services (owner decisions on record)

| Service | Decision | Evidence |
| --- | --- | --- |
| Google Gemini | Accepted as an optional feature. The student brings their own key. It runs only when the student scans. | `@google/genai` in `package.json` since 2026-08-14 (`aaf5ba9`); current scan design in `3ab0b7b` |
| Sentry | In the app since 2026-08-10, always on. | `app/_layout.tsx`, commit `a09d221` |

The old success measure "zero outgoing network requests to third-party tracking or AI services" is not true for the current app. The owner must decide one of these:

1. Keep Sentry and Gemini, and state them in the README and in the app (current state of the docs).
2. Add a setting to turn Sentry off, or turn session replay off.
3. Remove Sentry.

## 7. Success measures

| Measure | How to check |
| --- | --- |
| Core flows work with no network | Device test in airplane mode. Not yet recorded. |
| Attendance numbers match the portal's method | `__tests__/academic_logic.test.ts` and a manual comparison with the portal |
| No data loss on update | `__tests__/migration_chain.test.ts`, backup tests, device upgrade test |
| Every network call is disclosed | README "Privacy and external services" table matches the code |
