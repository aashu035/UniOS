# UniOS Production Rebuild Design

## Goal

Turn UniOS from a seeded interface prototype into a private, production-ready academic operating system. The phone app owns the student's data and works without the internet. A nearby laptop can provide a higher-quality local AI tutor over the student's private LAN or USB connection; no cloud API is used.

## Product principles

- Start empty and ask the student to set up their real profile, semester, courses, and timetable.
- Every user-created item is editable and deletable.
- No fabricated attendance, assignments, materials, events, or analytics are shown as real data.
- Calendar data is correct by construction: a recurring class exists only on the explicitly selected weekdays.
- AI is private, optional, and additive; normal UniOS workflows never depend on it.

## Startup and data ownership

### Fresh installation

1. Run database migrations.
2. Seed only the immutable DCRUST grading scale.
3. If no profile exists, show onboarding.
4. Onboarding creates the profile and offers a real semester setup, or defers it until the Semester tab.
5. Empty states offer their relevant creation action rather than demo cards.

### Existing demo installation

The app will surface a one-time, explicit **Clear demo data** action when it finds the known legacy demo course codes. It lists the exact generated courses and child data it will remove and requires confirmation; it never removes a profile automatically. A normal course deletion will always remain available afterward.

## Academic model

### Semesters

The Semester tab becomes a real academic dashboard:

- Active semester identity, dates, type, and target CGPA.
- Courses belonging to it, overall credits, pending work, and study progress.
- Create, edit, activate, archive, and delete semesters.
- Activating a semester deactivates all others in one transaction.

### Courses / workspaces

The course form captures name, code, instructor, room, credits, attendance target, and optional colour. Creation never creates attendance records, tasks, timelines, study material, or events automatically.

Each course has a settings surface with:

- Edit metadata.
- Add schedule, task, attendance entry, study material, and study session.
- Delete course.

Course deletion is a confirmed transaction that removes its dependent tasks, resources, attendance records, portal snapshots, calendar events, and timeline entries. It then removes the course. Faculty and venue records are retained only if another course still references them.

## Timetable and planner

### Schedule creation

The planner has distinct actions for **Add class** and **Add one-time event**.

For a class, the student selects a course, start/end time, room override, and the weekdays it actually occurs. Weekdays are seven independently selectable toggle buttons; no day is preselected. Saving creates a schedule group and one recurring event for each selected weekday. Editing or deleting a group changes every occurrence in that group.

One-time events use a concrete date and support holiday, minor, exam, assignment, important work, and personal categories. They do not recur unless the student intentionally creates a recurrence.

### Planner presentation

- Day strip and timeline are driven only by stored events.
- Classes, exams, holidays, and work have clear labels and accessible colours.
- Empty days state that there is no schedule instead of showing mock cards.
- The home screen is rebuilt as a practical daily briefing: next class, upcoming deadline, quick add, current study progress, and a compact week view. It does not use fake counts or fake uploads.

## Study materials and learning progress

### Materials

Each course can hold documents, PDFs, links, notes, PYQs, reference books, exercises, and answers.

- Add from the document picker, typed note, or validated web link.
- Persist local files in the app's document storage and persist metadata in SQLite.
- Open files through the device viewer, open links safely, and display text notes in-app.
- Rename, tag, and delete any material. Deletion removes its local managed file as well as database metadata after confirmation.

### Progress

Students log class study or self-study sessions with duration, topics, confidence, and optional linked material. The dashboard reports real totals and recent activity. No study progress is invented.

## Private local tutor

### Architecture

The phone is the UniOS user interface and local source of truth. The laptop runs the optional local model and retrieval service. They communicate only over the user's LAN or USB tethering with a pairing token; neither component contacts a cloud API.

```text
UniOS phone app
  ├─ SQLite: profile, courses, planner, materials metadata, study profile
  └─ paired local connection
                 │
                 ▼
Laptop companion
  ├─ local 7–8B quantized model
  ├─ local embedding / retrieval index for approved materials
  ├─ learning-profile adapter
  └─ answer, explanation, quiz, schedule suggestion APIs
```

### Capabilities

- Answer questions using only the material the student explicitly indexes.
- Explain concepts at the student's preferred depth, language mix, examples, and pace.
- Generate practice questions from PYQs, books, and notes.
- Extract candidate dates, holidays, minors, exams, homework, and important work from approved materials; the app always asks for confirmation before creating calendar/task records.
- Recommend study sessions based on real deadlines and logged progress.

### Personalization

The first personalization layer is a private learning profile built from explicit preferences and in-app feedback. It records explanation preferences, language, common misconceptions, confidence history, and successful study formats.

An opt-in lightweight adapter-training workflow may be added later. It runs only on the local laptop while idle/charging, trains on a student-approved feedback dataset, and is never necessary for baseline tutoring. This avoids treating full model fine-tuning as a requirement for useful personalization.

## Reliability and privacy

- Explicit loading, error, retry, and offline states; the Android splash must never persist indefinitely.
- Validate migrations and startup state before leaving the splash.
- Log local, non-sensitive startup diagnostics in development builds; remove verbose logging from production builds.
- No API keys, cloud inference, telemetry, or material uploads.
- Export and local backup remain available.

## Visual direction

The visual direction is an information-dense but calm academic planner: high-contrast ink and paper tones, precise spacing, compact actionable cards, and a strong daily timeline. The home screen prioritizes the next decision the student needs to make instead of decorative hero content. Empty states teach the next action without pretending data exists.

## Delivery sequence

1. Diagnose and fix the release startup/splash issue on a connected device or emulator.
2. Replace demo seeding and add safe demo-data cleanup.
3. Build semester management and course deletion with child-data cleanup.
4. Build recurring weekday timetable and one-time event flows.
5. Build real material CRUD and study-progress logging.
6. Redesign home and empty states around live data.
7. Add the laptop companion, pairing, local retrieval, and tutoring features.
8. Verify type safety, database migrations, Android release bundle contents, and critical flows on-device.

## Acceptance criteria

- A new install has no fake courses, tasks, attendance, materials, or schedule.
- A student can create, edit, and delete semesters, courses, schedule groups, events, tasks, materials, and study sessions.
- A class appears only on the selected weekdays.
- Course deletion removes all dependent records and does not leave orphaned items.
- All data workflows work with no internet connection.
- The release APK starts past the splash without Metro.
- The AI tutor has no cloud dependency and operates only when the paired laptop companion is available.
