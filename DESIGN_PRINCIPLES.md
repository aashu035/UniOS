# UniOS Design Principles

This document acts as the core contract for the design and engineering of UniOS. Every new feature, screen, and component must adhere strictly to these rules.

## Core Design Rules

1. **Answer One Question:** Every screen must answer one primary question. Do not overload users with scattered information.
2. **Whitespace over Density:** Whitespace is preferred over more information. Allow the interface to breathe. It creates calm productivity.
3. **Typography Creates Hierarchy:** Rely on typography (size, weight, spacing) rather than borders and boxes to group related information.
4. **Purposeful Color:** Colors communicate state (success, warning, error) or brand, not mere decoration. Maintain a minimal palette.
5. **Component Reuse:** Always reuse existing components before creating new ones. No bespoke UI elements for a single screen.
6. **Strict Tokens:** No hardcoded spacing, colors, radius, or typography values. Everything must be sourced from the `tokens/` directory.
7. **Meaningful Motion:** Animations communicate state changes only. Do not use flashy or distracting animations.
8. **Workspace Concept:** Every academic entity (subject, internship, research project) belongs to a unified "Workspace" model.

## Engineering Rules

Before implementing any new feature, ask the following checklist:

1. Can an existing component be reused?
2. Does this belong to an existing domain?
3. Is the styling fully tokenized?
4. Is the data accessed *only* through repositories?
5. Does this screen answer a single user question?
6. Does this reduce context switching for the student?

**If any answer is "No", stop and refactor before continuing.**

## Attendance Identity Contract

Attendance records are uniquely identified by an **occurrence identity** derived from the academic schedule:

- Recurring sessions: `rec_{recurringScheduleId}_{localDate}` (e.g. `rec_42_2026-08-18`)
- Exception sessions: `ex_{exceptionId}` (e.g. `ex_7`)

### Rules

1. IDs are generated **only** by `CalendarService.getEffectiveSchedule()`. The UI never constructs occurrence IDs.
2. Recurring schedule IDs are **never reused** after deletion.
3. Same-day move/replacement retains the original recurring identity with modified times.
4. Cross-day moves produce a cancellation (of the original) plus a new extra occurrence.
5. Cancelled occurrences **cannot** receive new attendance.
6. Exception IDs are stable across app restarts.
7. New attendance writes **must explicitly set** `occurrence_id` and `identity_status = 'resolved'`. Never rely on database defaults for domain writes.

## Unresolved Legacy Attendance Policy

Historical attendance rows from before the identity system was introduced carry `identity_status = 'unresolved_legacy'` and `occurrence_id = NULL`.

### Visibility Rules

| Context | Unresolved rows |
|---|---|
| **Occurrence cards** (timetable UI) | Excluded — cannot be assigned to a specific session |
| **Occurrence editing** | Unavailable — not editable through session cards |
| **Course/component attendance totals** | **Included** — they represent real historical evidence |
| **New attendance** | Always occurrence-resolved |

### One-Record Limitation

An unresolved record counts as **one historical attendance instance**, even if multiple possible sessions existed on that date. This is an unavoidable limitation of the old identity model and must not be presented as session-level certainty.

### Repair Behavior

The `AttendanceRepairService` runs on every app initialization (idempotent):
- **Exactly one matching occurrence** → resolve
- **Zero matches** → remain unresolved
- **Multiple matches** → remain unresolved
- **No first-match heuristic. No deletion.**

## Product Vision
UniOS is not just an attendance app. It is a premium Academic Operating System designed to replace scattered tools (WhatsApp, Drive, PDF Readers, ERPs) into a unified, elegant, Apple/Notion-inspired workflow.
