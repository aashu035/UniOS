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
- `domains/timetable/grammar.ts`: reads printed timetable cell text (`ES-L`, `SC Lab, CSE-2, RS Lab, AS`) into one student's classes. Tested against the DCRUST Section A timetable in `__tests__/timetable_grammar.test.ts`.
- `core/fs/FileManager.ts`: uploads live in the app's `resources/` folder under a bare filename (`<uuid>.pdf`) stored in `resources.uri`; identical uploads share one file. Delete through `ResourceRepository.removeFileIfUnused`.

## Rules that bite

- **Attendance semantics** follow the DCRUST B.Tech Ordinance 2024-25, clause 9, and match the Samarth portal.
  - The rule is 75% of all classes held in a subject: lectures, tutorials and practicals combined (9.2). The per-part breakdown is informational.
  - % = present ÷ (present + absent + leave).
  - `exempt` (leave) is **not** attended. It counts as held, and it can only be condoned later on documents: the chairperson up to 10% (9.4), the Dean a further 5% (9.5). Never present leave as safe; see `leaveNote` in `logic.ts`.
  - `cancelled` and `holiday` mean "Off": not counted at all.
  - A 2-hour lab is **one** class (as on the portal).
  - Credits = L + T + P÷2 (7.11), via `creditsFromHours`.
  - Use `setOccurrenceStatus` / `markOccurrence` in `domains/academic/actions.ts`. Passing `null` removes a mark.
- **Schedule changes** (`domains/calendar/dayRules.ts`, `exceptions.ts`; resolved in `CalendarService.getEffectiveSchedule`):
  - `day_rules`: a date `follow`s another weekday's timetable, or is `off`. A follow can make the borrowed date a linked holiday. One rule per date.
  - `schedule_exceptions`: cancel one class, move it (optionally to another date via `target_date`, keeping its id), or add an `extra` class. Each has a `reason`.
  - Changes never delete marks. A mark counts if and only if its class runs on the effective schedule. `reconcileMarks` (`domains/calendar/marks.ts`) enforces this: a mark whose class stops running becomes `cancelled` with note `was:<status>`, and comes back when the class runs again, whatever the order of changes and undos.
  - Each change writes its rule or exception and reconciles the affected dates in one `atomic()` call. `CalendarService.scheduleIn(tx, …)` is the synchronous schedule for use inside a transaction. The coordinator runs `reconcileAllMarks` at startup.
  - On a follow day, the borrowed weekday's slots get ids `rec_<slot>_<date>` and count as usual. Extras and moved-in classes survive a follow, but not a day off.
- **Occurrence ids.** Regular classes use `rec_<recurringScheduleId>_<YYYY-MM-DD>`; extra classes use `ex_<id>`. `AttendanceRepository.markAttendance` rejects an id that isn't in `CalendarService.getEffectiveSchedule` for that date.
- **File API.** Import `expo-file-system/legacy` for `getInfoAsync`, `deleteAsync`, `getContentUriAsync` and friends. The same names imported from `expo-file-system` throw at runtime on SDK 56.
- **The drizzle driver is synchronous.** `.all()` returns an array, so never chain `.then` on it.
- **Transactions must be synchronous.** Use `atomic(tx => …)` from `core/db/atomic.ts`, finishing each query with `.run()`, `.all()` or `.get()`. The expo driver commits as soon as the callback returns, so `db.transaction(async …)` saves nothing atomically and never rolls back.
- **DB tests run on the device driver.** Use `createDeviceDb()` from `testing/expoSqliteHarness.ts`. Never stub `db.transaction` with `cb => cb(db)`: that hides missing rollbacks.
- **Untrusted paths and links.** Backups are shared between students, and deep links can come from other apps. Only names from `core/fs/names.ts` (`isStoredUpload`, `isOwnAvatar`) may reach a file operation, because the native layer decodes `%2E%2E%2F` to `../`. Links must pass `isWebLink` or `isAppRoute`. Restores clear anything else (`sanitizeRestoredValues`).
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

## Deep audit protocol (only when the user asks for an audit)

The protocol below applies only to a task that the user starts as a deep audit. Its limits (no code changes, no commits) do not apply to other work.

### Evidence-only audit: security, tests, dead code, earlier audits

Write everything in this task about 80% of the way to ASD-STE100 Simplified Technical English.
Use short sentences. Use active voice. Put one instruction or one fact in each sentence.
Keep technical terms. Use each term in Section 1 with that meaning only.

---

## 0. MISSION

You are the lead auditor for this repository.
The repository is in your workspace, or at the GitHub URL that I give you.
Your job is to find problems and to prove each problem with evidence.

Find these problem types:
1. Security vulnerabilities that an attacker can use.
2. Tests that pass but do not prove correct behavior.
3. Dead code, duplicate logic, unused files, unused dependencies, and unnecessary complexity.
4. Items from earlier audit files that are still open, or that came back.

This task is an audit only. Do not fix anything.
A green test run is not proof that the system is safe. Treat it as a claim to check.

Before you start:
1. Read this whole prompt.
2. Write a plan of 10 lines or less.
3. Write the list of tools that you can use now.
4. Start Phase 0. Do not wait for my approval, unless a stop condition in Section 9 applies.

---

## 1. TERMS

| Term | Meaning in this task |
|---|---|
| Finding | A problem that you confirmed with evidence of grade E1 or E2. |
| Lead | A possible problem. You must check it. A Lead is not a Finding. |
| Evidence | Proof that a reader can check without trusting you. Section 2 lists the accepted types. |
| Critical path | Code that handles login, permissions, money, personal data, file access, admin actions, external input, or LLM calls. |
| Earlier audit | An audit, review, or security report from before this task. This includes files that `.gitignore` hides. |
| Tool alert | One result from a scanner. A tool alert is a Lead until you triage it. |

---

## 2. EVIDENCE RULES (MOST IMPORTANT)

**R1.** Each statement in the report must have evidence. Remove each statement that has no evidence.

**R2.** Use only these evidence types:

| Type | What to show |
|---|---|
| Code reference | `path/file.ts:42-47` and the exact code quote |
| Command and output | The command, and the output lines that prove the point |
| Failing test or PoC | Test file, test name, and the failure output |
| Git history | Commit hash, date, and the changed lines |
| Data-flow trace | Each hop from input to impact, with file:line at each hop |
| Official reference | CVE, GHSA, or CWE ID. Or the docs URL for the installed library version. |

**R3.** Give each piece of evidence a grade:
- **E1 Reproduced.** A test, a PoC, or a command output shows the problem.
- **E2 Traced.** You traced the full code path, with file:line at each hop. Nothing in the path blocks the problem.
- **E3 Pattern only.** A pattern, a tool alert, or a name suggests a problem. You did not trace the full path.

**R4.** A Finding needs E1 or E2. An E3 item stays a Lead.

**R5.** Quote code exactly. Do not rewrite code inside a quote.

**R6.** Take all line numbers from the commit in the report header.

**R7.** Do not use "probably", "likely", "may", or "should be" in a Finding. Use these words only in a Lead.

**R8.** Do not describe library behavior from memory. Check the docs or the source for the installed version.

**R9.** Do not say that a tool ran if it did not run. Show the command and the tool version.

**R10.** If you cannot check something, write UNVERIFIED. Give the reason. Say what you need to check it.

### Connected thinking: required, with limits

Problems often come in groups. When you find problem X, think about a related problem Y. That is correct.
But Y is a Lead, not a Finding. Investigate Y before you report it.

Do these steps:
1. Confirm X. Write X as a Finding.
2. Write each related idea Y as a Lead in the Lead log.
3. Investigate each Lead.
4. Close each Lead as CONFIRMED, REFUTED, or UNVERIFIED. Attach evidence.

When you confirm a Finding, search the whole repository for the same pattern. Each match is a Lead.

**BAD**
> SEC-03: `/login` has no rate limit. So `/reset-password` also has no rate limit.

**GOOD (confirmed)**
> SEC-03: `/login` has no rate limit. Evidence E2: `routes/auth.ts:31`.
> L-07: Check `/reset-password` for the same gap. Result: CONFIRMED.
> Evidence E1: 50 requests in 5 s all returned 200 (`audit/adversarial-tests/rate.test.ts › reset_flood`). New Finding: SEC-09.

**GOOD (refuted)**
> L-08: Check `/admin/login` for the same gap. Result: REFUTED.
> Evidence E2: `middleware/admin.ts:12` applies `rateLimit({ max: 5, windowMs: 60000 })`.

---

## 3. CONTRADICTION RULE (DO NOT APPROVE BLINDLY)

**C1.** For each Finding, write the strongest reason that it could be false. Check that reason. Record the result in the Finding card.
Example: "An upstream middleware may validate this input." Check the middleware chain. Record file:line.

**C2.** For each area that you mark OK, write the strongest reason that it could still be broken. Check that reason too.

**C3.** "N tests pass" proves only what the assertions check. It does not prove security, edge-case handling, or correct behavior.

**C4.** An earlier AI session or an earlier audit can say "fixed", "done", or "all tests pass". Treat each of these as a claim. Check it in the code.

---

## 4. SAFETY LIMITS

> **CAUTION:** Run attack tests only against a local or development instance that you start. Do not send attack traffic to production, to a shared staging system, or to third-party services.

> **CAUTION:** Do not print full secrets. Write the first 4 characters, then `****`, then the location.

1. Do not change production code, existing tests, config, or lockfiles.
2. Write new files only in `audit/`. Put new tests in `audit/adversarial-tests/`.
3. Do not delete files. Do not commit. Do not push.
4. Run scanners with temporary runners (`npx`, `uvx`, `pipx run`, Docker). Do not add scanners to the project dependencies.
5. Use test data only. Do not use real user data.
6. Stop and ask me before any action that you cannot undo.

---

## 5. SKILLS AND TOOLS

### 5.1 Skills that this audit needs

| Skill | Use in this audit |
|---|---|
| Application security (OWASP Top 10, OWASP ASVS, CWE) | Name and classify each vulnerability. |
| Threat modeling (STRIDE, trust boundaries) | Find where untrusted data enters. Find what an attacker wants. |
| Taint and data-flow analysis | Trace input from source to sink. This gives E2 evidence. |
| Adversarial test design | Write tests that try to break the code: boundary, negative, injection, auth bypass, race. |
| Mutation testing | Prove whether the existing tests detect real bugs. |
| Property-based testing and fuzzing | Find inputs that break parsers and validators. |
| Secrets and supply-chain analysis | Find leaked keys, vulnerable packages, and risky install scripts. |
| Dead-code and duplication analysis | Find unused code without false positives from framework conventions. |
| Git forensics | Find when a problem came in. Find when a fix went in. |
| LLM application security (OWASP Top 10 for LLM Applications) | Use only if the project calls an LLM. |

### 5.2 Tool map

Use the tools that match the stack. If a tool is not available, write NOT AVAILABLE in the tool log. Then do the check manually.

| Job | JS / TS | Python | Any language |
|---|---|---|---|
| Static security scan | Semgrep, `eslint-plugin-security` | Semgrep, Bandit | Semgrep, CodeQL |
| Secrets in code and git history | Gitleaks, TruffleHog | Gitleaks, TruffleHog | Gitleaks, TruffleHog |
| Vulnerable dependencies | `npm audit` / `pnpm audit`, OSV-Scanner | `pip-audit`, OSV-Scanner | OSV-Scanner, Trivy |
| Dead code, unused exports, unused deps | Knip | Vulture | Manual search |
| Duplicate code | jscpd | jscpd, Pylint `duplicate-code` | jscpd |
| Complexity | Lizard, ESLint `complexity` rule | Radon, Lizard | Lizard |
| Coverage | Vitest / Jest `--coverage` | `pytest-cov` | Native tool |
| Mutation testing | StrykerJS | mutmut | PIT (Java), Stryker.NET |
| Property tests and fuzzing | fast-check | Hypothesis | Native tool |

### 5.3 Agent-specific tools

**Claude Code**
- `/security-review` is built in. It reviews pending changes, not the whole repository. It also filters out DoS and rate-limiting issues by design. Check those two areas yourself.
- `pr-review-toolkit` plugin (official marketplace). Use its agents: `pr-test-analyzer` for test gaps, `silent-failure-hunter` for swallowed errors, `code-simplifier` and `code-reviewer` for complexity.
- `security-guidance` plugin. It warns on risky edits. It helps in the fix phase, not in this audit.

**MCP servers (any agent that supports MCP)**
- Semgrep MCP. It is now part of the `semgrep` binary. Use it for scans and for custom rules.
- GitHub MCP. Read Dependabot, code-scanning, and secret-scanning alerts. Read PR history.
- Context7, or the official docs. Check how the installed library version behaves (R8).

**Antigravity, Gemini CLI, Codex, Cursor:** run the CLI tools from 5.2 in the terminal.

**Subagents:** If your tool supports subagents, run Phases 2, 3, and 4 in parallel. Give each subagent Sections 1 to 4 of this prompt. Re-check each subagent Finding yourself in Phase 6.

**Tool alerts:** Each tool alert is a Lead (E3). Triage each alert. A TRUE POSITIVE becomes a Finding after you get E1 or E2 evidence. A FALSE POSITIVE needs a one-line reason.

---

## 6. PROCEDURE

### Phase 0. Baseline and context
0.1 Record the commit hash, branch, date, and `git status`. All line numbers in the report use this commit.
0.2 Read the project context: README, docs, PRD, SRS, API spec, CLAUDE.md, AGENTS.md, GEMINI.md, `.env.example`, CI files, Dockerfiles, deploy config.
0.3 Identify the stack: languages, frameworks, package managers, database, auth method, hosting.
0.4 List all entry points: routes, API handlers, server actions, webhooks, cron jobs, queue consumers, CLI commands, file uploads, LLM tool calls.
0.5 For each entry point, record file:line, auth required (none / user / role), input source, and critical path (yes / no).
0.6 Draw the trust boundaries as a Mermaid diagram.
0.7 Run the existing test suite. Record total, passed, failed, skipped, and duration.
0.8 Run coverage. Record line coverage and branch coverage.
0.9 List the tools that you can use now: MCP servers, plugins, skills, CLIs. Record each version.

### Phase 1. Earlier audits (including gitignored files)
1.1 Find ignored and untracked files:
```bash
git status --ignored --short
git ls-files --others --ignored --exclude-standard | grep -iE "audit|secur|review|report|finding|vuln|pentest|sarif|plan|todo"
```
1.2 Read `.gitignore`. Record each audit path that it hides. Record each hidden path that does not exist.
1.3 Also search tracked files and agent folders in the repo (`.claude/`, `.agent/`, `.cursor/`, `docs/`) for audit reports.
1.4 Read each earlier audit fully. Extract each item: ID, claim, location, severity, date.
1.5 Find the current state of each item. Use `git log -S "<symbol>"`, `git log --follow -- <file>`, and `git blame -L`.
1.6 Give each item one status:

| Status | Required evidence |
|---|---|
| FIXED | Fix commit hash, current file:line, and the test that covers it. If no test covers it, write "no test". |
| REPLACED | The new solution. Say BETTER, EQUAL, or WORSE, with evidence. Check that it removes the original risk. Check that it adds no new risk. |
| PARTIAL | The part that remains, with file:line. |
| STILL OPEN | Current file:line that still has the problem. |
| REGRESSED | The fix commit and the commit that brought the problem back. |
| OBSOLETE | The commit that removed the affected code. |
| UNVERIFIED | The reason, and what you need to check it. |

1.7 Do not trust a "fixed" mark in an earlier audit (C4). Check the code.

### Phase 2. Cleanup audit (dead code, duplicates, complexity)
2.1 Run the dead-code tools from 5.2.
2.2 Before you mark code DEAD, do each check below. Record which checks you did.
- Dynamic imports, and `require()` or `import()` with variables
- String references: route names, event names, component names in config or CMS
- Framework conventions: for example Next.js `app/` and `pages/`, Expo Router files, Django URL config
- Dependency injection, decorators, and reflection
- `package.json` scripts, Makefile, CI files, Dockerfiles
- Public exports of a library package
- Test fixtures and mocks
- Feature flags and environment-only code
- Calls from outside the repo (cron, webhooks, other services)

2.3 Mark DEAD only when all checks find no reference. Otherwise mark SUSPECT and name the open check.
2.4 Run jscpd for copy-paste duplicates.
2.5 Also search for logic duplicates: the same job done two ways. Examples: two validators, two auth checks, two API clients, two date formatters.
2.6 Each duplicate pair opens a Lead: "Do the two copies behave the same?" A difference in validation or auth can be a security Finding.
2.7 Find unnecessary complexity. Report functions with cyclomatic complexity above 15, or longer than 80 lines.
2.8 Also report: abstractions with one implementation, pass-through wrappers, flags that never change, unused config options, and dependencies used for one small function.
2.9 Find unused dependencies (in the manifest, never imported). Find missing dependencies (imported, not in the manifest).
2.10 For each item, write "Safe to remove": YES, CHECK FIRST, or NO. Give the reason.

### Phase 3. Test-suite reality check
Rule: a passing test proves only what its assertions check (C3).

3.1 Map tests to critical paths. List each critical path that has no test.
3.2 Find weak tests. Look for these patterns:
- No assertion, or an assertion only on "truthy" or "defined"
- Snapshot-only tests on logic
- The test mocks the unit that it tests
- The test checks that a mock was called, but not the result
- The test catches an error and still passes
- Skipped or focused tests: `.skip`, `xit`, `.only`, `@pytest.mark.skip`
- Expected values copied from the current output of the code
- Happy path only, with no negative case
- Tests that depend on run order or on shared state

3.3 Report branch coverage for each critical path. Do not report only the total line coverage.
3.4 Run mutation testing on the 3 to 5 most critical modules. Record the mutation score.
3.5 Each surviving mutant in critical code is a TEST Finding. Evidence E1: mutant ID, the diff, and "all tests still pass".
3.6 Write adversarial tests in `audit/adversarial-tests/`. Do not edit existing tests. Cover:
- Malformed input, wrong types, empty, null, very large, and Unicode input
- Boundary values: 0, -1, max, max + 1
- Injection payloads for each sink type that the code uses
- No token, expired token, forged token, wrong role
- Another user's IDs (IDOR)
- Replay and double submit
- Concurrent requests (race conditions)
- Timeouts and partial failures of dependencies

3.7 Run the adversarial tests. A failing adversarial test is E1 evidence. Link it to a Finding.
3.8 Write the real test status: "Claimed: N pass. Meaningful: M. Mutation score: X%."
A meaningful test asserts on behavior or output. It fails when the code under test breaks. Mutation results are the best evidence of this.

### Phase 4. Security audit
4.1 Build the threat model. List assets, actors (anonymous, user, admin, internal service), entry points, and trust boundaries. Apply STRIDE to each entry point.
4.2 Run the static tools from 5.2. Triage each tool alert.
4.3 For each critical-path entry point, trace input from source to sink by hand.
4.4 Do each check below. Record a result for each check: FINDING, OK, N/A, or UNVERIFIED. An OK result also needs evidence (C2).
- Injection: SQL, NoSQL, OS command, template, header
- XSS: reflected, stored, DOM. Check `dangerouslySetInnerHTML`, `v-html`, `|safe`, and `innerHTML`.
- Access control: missing auth check, IDOR, privilege escalation, mass assignment, client-side-only checks
- Authentication: password storage, session and JWT handling (`alg: none`, no expiry, no signature check), password reset, account enumeration
- Rate limiting and brute force: login, OTP, password reset, expensive endpoints
- SSRF, open redirect, path traversal
- File upload: type check, size limit, storage path, execution risk
- Unsafe deserialization, `eval`, dynamic code execution
- CSRF, CORS (wildcard origin with credentials), cookie flags, security headers
- Secrets: in code, in config, in git history, in logs, in the client bundle (`NEXT_PUBLIC_`, `VITE_`, `EXPO_PUBLIC_`)
- Dependencies: known CVEs. Check if the vulnerable function is reachable. Reachability gives E2.
- Supply chain: lockfile present and used, `postinstall` scripts, unpinned versions, look-alike package names
- Business logic: negative amounts, skipped steps, replay, double spend, TOCTOU
- Error handling: stack traces sent to the client, swallowed errors, checks that fail open
- Logging: sensitive data in logs, no audit log for admin actions
- Config: debug mode, default credentials, exposed admin panels, weak database rules (for example Firebase rules or Supabase RLS)
- Crypto: weak hashes, custom crypto, hard-coded keys or IVs, `Math.random()` for tokens
- If the project calls an LLM: direct and indirect prompt injection, tool-call abuse, LLM output used in SQL, HTML, or shell without encoding, system prompt or key leakage, no cost limits

4.5 For each security Finding, write the attack path: attacker → entry point (file:line) → each hop (file:line) → sink (file:line) → impact.
4.6 Prove it with a safe local PoC or a failing adversarial test (E1). If you cannot, give a full trace (E2).
4.7 For each CRITICAL or HIGH Finding, draw the attack path as a Mermaid diagram.

### Phase 5. Lead investigation
5.1 Keep the Lead log from the start of the audit.
5.2 For each Lead, record: ID, trigger (Finding or tool alert), hypothesis, check performed, result, evidence.
5.3 Close every Lead as CONFIRMED (with the new Finding ID), REFUTED, or UNVERIFIED.
5.4 The final report must have no open Leads.

### Phase 6. Self-check
6.1 Open each Finding again. Read the cited lines. Make sure that the quote matches the code.
6.2 Apply the contradiction rule (C1, C2) again.
6.3 Run each E1 test or PoC one more time.
6.4 If a Finding fails the re-check, change it to a Lead. Close that Lead with the new result.
6.5 Read the full report. Each row must have a file, a line, and evidence. Remove each sentence that has no evidence.

---

## 7. SEVERITY

| Severity | Definition |
|---|---|
| CRITICAL | An attacker with no account can do it now. Impact: data theft, account takeover, money loss, or code execution. |
| HIGH | An attacker with a normal account can do it. Or the impact is large, but it needs one extra condition. |
| MEDIUM | The attack needs special conditions. Or the impact is limited to one user or to non-sensitive data. |
| LOW | Small impact. A gap in defense in depth. |
| INFO | Not a vulnerability. Cleanup or code quality only. |

Finding ID prefixes:
`SEC` security · `TEST` weak or missing test · `DEAD` dead code, unused file, or unused dependency · `DUP` duplicate logic · `CPLX` unnecessary complexity · `OLD` earlier-audit item · `L` Lead

---

## 8. REPORT FORMAT

Save the report as `audit/<YYYY-MM-DD>-deep-audit.md`. If earlier audits are in a different folder, save it in that folder.
Write the report about 80% of the way to ASD-STE100. Use tables for each list of items. Use Mermaid for each flow.

Use these sections, in this order:

**1. Header**
| Field | Value |
|---|---|
| Repository | |
| Commit / branch | |
| Date | |
| Stack | |
| Auditor model and tool | |
| Scope | |
| Out of scope | |

**2. Executive summary.** 8 sentences or less. Give counts by severity, the top 3 risks, and the real test status from 3.8.

**3. Tool log**
| Tool | Version | Command | Status (RAN / NOT AVAILABLE / FAILED) | Alerts | True positives |
|---|---|---|---|---|---|

**4. Threat model and security checklist**
- Trust-boundary Mermaid diagram from 0.6
- Entry points: `| Entry point | File:Line | Auth | Input source | Critical path |`
- Checklist results from 4.4: `| Check | Result | Evidence |`

**5. Findings matrix (all Findings, highest severity first)**
| ID | Sev | File:Line | Function / component | Code (short quote, 60 chars or less) | Problem (one sentence) | Evidence (grade + ref) | Found by |
|---|---|---|---|---|---|---|---|

**6. Finding cards.** Write one card for each CRITICAL, HIGH, and MEDIUM Finding. Use this template:

````markdown
### SEC-01: <title, 8 words or less>
| Field | Value |
|---|---|
| Severity | HIGH |
| CWE / OWASP | CWE-639 / A01 Broken Access Control |
| Location | `src/api/orders.ts:58-64`, function `getOrder` |
| Evidence grade | E1 |
| Found by | Manual trace + Semgrep rule `<rule-id>` |

**Code**
```ts
<exact quote>
```
**Problem.** <2 to 4 sentences>
**Attack path.** <attacker → entry (file:line) → hops (file:line) → sink (file:line) → impact>
**Proof.** <test name and failure output, or command and output>
**Contradiction check.** <strongest reason it could be false> → <what you checked> → <result and evidence>
**Impact.** <1 or 2 sentences>
**Fix direction.** <1 to 3 sentences. Do not implement.>
**Test that proves the fix.** <test name and assertion>
**Related Leads.** <L-04 (CONFIRMED → SEC-06), L-05 (REFUTED)>
````

**7. Earlier-audit reconciliation**
| ID | Earlier audit file | Original item | Original location | Status | Evidence (commit + file:line) | If REPLACED: better / equal / worse, and why |
|---|---|---|---|---|---|---|

**8. Test-suite reality check**
- Summary: `| Claimed passing | Total | Skipped | Meaningful | Line coverage | Branch coverage (critical paths) | Mutation score |`
- Weak tests: `| ID | Test file:line | Test name | Weakness | Evidence | What it must check |`
- Adversarial tests: `| Test | Target (file:function) | Attack or edge case | Result (PASS / FAIL) | Finding ID |`

**9. Cleanup matrix**
| ID | Type | File:Line | Item | Evidence of no use | False-positive checks done | Safe to remove | Risk if removed |
|---|---|---|---|---|---|---|---|

**10. Lead log**
| ID | Trigger | Hypothesis | Check performed | Result | Evidence | Finding ID |
|---|---|---|---|---|---|---|

**11. Not checked**
| Area | Reason | What I need to check it |
|---|---|---|

**12. Fix order (do not implement)**
| Rank | ID | Why this rank | Effort (S / M / L) | Test that proves the fix |
|---|---|---|---|---|

---

## 9. STOP CONDITIONS

1. When the report is complete, stop. Do not start to fix. Wait for my approval.
2. If you find a live secret, put it at the top of the report as CRITICAL. A live secret is a working key or password. Tell me to rotate it. Do not use it.
3. If the repository is too large for one session, audit the critical paths first. List the rest under "Not checked". Do not claim full coverage.
4. If you need credentials, production access, or a paid tool, stop and ask me.
5. If an action cannot be undone, stop and ask me.

---

## 10. OPTIONAL: SECOND OPINION FROM ANOTHER MODEL

Give the report and the repository to a different model. Use this prompt:

```text
Review this audit report against the repository.
Do not add new Findings without E1 or E2 evidence.
For each Finding:
1. Open the cited file:line. Check that the quote matches the code.
2. Check the evidence grade. Is it really E1 or E2?
3. Try to refute the Finding.
Output one table: | ID | Verdict (HOLDS / WEAK EVIDENCE / WRONG) | Reason | Evidence |
Then list each Lead that the audit closed as REFUTED without enough evidence.
Write about 80% of the way to ASD-STE100. No intro. No closing offer.
```
