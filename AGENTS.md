# UniOS: notes for AI coding agents

Read by Claude Code (via `CLAUDE.md`), Codex, Cursor, Copilot, Gemini CLI and other tools that follow the AGENTS.md convention. Multi-agent coordination notes live in `AGENT_SYNC.md`.

UniOS is an offline-first student app (Android first): courses, timetable, attendance with a skip budget, tasks, files, and a read-only snapshot of the college portal's attendance. Everything is stored on the device in SQLite.

## Stack

- Expo SDK 56, expo-router, React Native 0.85 (Hermes), reanimated 4, react-native-svg, lucide-react-native.
- drizzle-orm on expo-sqlite. Migrations live in `drizzle/` and are run by `core/db/coordinator.ts`.
- NativeWind v4 is used by the older screens. The redesigned screens use `components/uni/*` with StyleSheet.
- Sentry (`@sentry/react-native`) for crashes, performance and user reports.
- Jest with ts-jest. DB tests run on better-sqlite3 migrated from `drizzle/`.

## Commands

| Task | Command |
| --- | --- |
| Typecheck + all tests (run before every commit) | `npm run check` |
| Tests only | `npm test` |
| Start Metro for the dev build | `npm run dev` |
| Same, with Expo MCP local tools (screenshots, taps, logs) | `npm run dev:mcp` |
| Android logs over USB | `npm run logs:android` |
| Build the dev client APK (once per native change) | `npm run build:dev` |
| Build the APK used daily | `npm run build:preview` |

Expo Go is **not** supported: it only runs the newest SDK and lacks some native modules. Use the dev build ("UniOS Dev", package `com.anonymous.UniOS.dev`). It installs next to the real app and never touches its data. Variants are defined in `app.config.js` and `eas.json`.

## Where things are

- `app/`: routes. `(main)/` holds the tabs: today, schedule, work, menu.
- `components/uni/`: design system. Includes `theme.ts` tokens, `primitives.tsx`, `Icon.tsx`, `TabBar.tsx` and `MarkSheet.tsx`.
- `domains/academic/`: read model for the redesign.
  - `snapshot.ts` loads everything in one pass.
  - `logic.ts` holds pure attendance and date maths.
  - `derive.ts` builds alerts and queues.
  - `actions.ts` holds writes.
- `domains/<name>/repository.ts`: data access per domain (attendance, workspace, task, calendar, …).
- `core/diagnostics/`: in-app log buffer and bug-report builder.
- `app/workspace/[id]/attendance.tsx`: the older full attendance log. Keep it; the course page links to it.

## Rules that bite

- **Attendance semantics** follow the DCRUST B.Tech Ordinance 2024-25, clause 9, and match the Samarth portal.
  - The rule is 75% of all classes held in a subject: lectures, tutorials and practicals combined (9.2). The per-part breakdown is informational.
  - % = present ÷ (present + absent + leave).
  - `exempt` (leave) is **not** attended. It counts as held, and it can only be condoned later on documents: the chairperson up to 10% (9.4), the Dean a further 5% (9.5). Never present leave as safe; see `leaveNote` in `logic.ts`.
  - `cancelled` and `holiday` mean "Off": not counted at all.
  - A 2-hour lab is **one** class (as on the portal).
  - Credits = L + T + P÷2 (7.11), via `creditsFromHours`.
  - Use `setOccurrenceStatus` / `markOccurrence` in `domains/academic/actions.ts`. Passing `null` removes a mark.
- **Occurrence ids.** Regular classes use `rec_<recurringScheduleId>_<YYYY-MM-DD>`; extra classes use `ex_<id>`. `AttendanceRepository.markAttendance` rejects an id that isn't in `CalendarService.getEffectiveSchedule` for that date.
- **The drizzle driver is synchronous.** `.all()` returns an array, so never chain `.then` on it.
- **Migrations.**
  - Statements must be separated by `--> statement-breakpoint`.
  - Never rename or renumber existing files: `drizzle/migrations.js` maps them by alias.
  - `__tests__/migration_chain.test.ts` must pass.
- **NativeWind drops function-form styles** (`style={({ pressed }) => …}`) on native. Use `Tap` from `components/uni/primitives.tsx`.
- **No Android `Alert.alert` with more than 3 buttons.** Android silently drops the rest. Use a sheet (see `MarkSheet`).
- **Dates.** Stored dates are normalised with `normalizeDate` in `domains/academic/snapshot.ts`. Never call `new Date('YYYY-MM-DD')` for local days; use the helpers in `domains/academic/logic.ts`.
- **Portal data is read-only.** Never ask for, store or log a student's portal password. The Samarth integration must use an in-app login where the user types it themselves.

## Debugging loop

1. Reproduce on the dev build with `npm run dev:mcp`.
2. With the Expo MCP server connected, use `collect_app_logs`, `automation_take_screenshot`, `automation_tap` and `open_devtools`.
3. Check Sentry, via the `sentry` MCP server or sentry.io:
   - Filter by `environment` (`development` / `preview` / `production`).
   - User reports arrive as Feedback, with `diagnostics.md` attached.
4. Write a failing test in `__tests__/` first when the bug is in logic or data, then fix.
5. Run `npm run check` before committing.

Users can send reports from **More → Report a problem**. The same text can be shared to any app, so a pasted report is a valid starting point.
