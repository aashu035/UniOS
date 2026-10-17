# UniOS promotion-readiness report

| Field | Value |
| --- | --- |
| Repository | `aashu035/UniOS` |
| Baseline | `master` = `b779d2d79310bf31dd94709447dd94fc132e2397` (checked with `git fetch origin master`) |
| Working branch | `chore/promotion-readiness`, local only, not pushed |
| Commits | `7f40672` docs, community files, CI · `f43b7f0` removal of unverified claims · this report |
| Date | 2026-10-17 |
| Scope | Documentation, community files, CI, schema review. No app code changed. |

Labels used: **Completed**, **Verified**, **Partially completed**, **Not tested**, **Awaiting approval**, **Recommended for later**.

## 1. Executive summary

- The docs described a laptop AI tutor that was deleted on 2026-10-14. They also said the app made no cloud or telemetry calls. Both claims were false. **Completed:** the docs now match the code.
- The app sends data to two services: Google Gemini (optional, the student's own key, only on scan) and Sentry (always on, including session replay). **Completed:** the README, the architecture doc and the SRS now disclose both.
- The README told people to run `npx expo start`. That is the Expo Go path, and Expo Go cannot run this app. **Completed:** the install steps now use a development build.
- **Completed:** CONTRIBUTING, CODE_OF_CONDUCT, SECURITY and a CI workflow are added.
- **Verified:** a clean `npm ci` followed by `npm run check` on Node 22 passed 42 of 42 suites and 379 of 379 tests.
- Five unused AI tables remain. **Completed:** I traced their compatibility. Removing them needs a staged plan. **Awaiting approval.**
- LICENSE was not changed. Its text is byte-identical to Expo's own license. **Awaiting approval.**
- UniOS is not production-ready. No device test is recorded for this commit.

## 2. Confirmed baseline

| Item | Evidence |
| --- | --- |
| Branch and commit before work | `claude/tender-brahmagupta-u6o2s9` at `b779d2d`; `origin/master` also `b779d2d` |
| Working tree | Clean (`git status --short` empty) |
| Node and npm | `v22.22.2`, `10.9.7` |
| Node required by React Native 0.85.3 | `^20.19.4 \|\| ^22.13.0 \|\| ^24.3.0 \|\| >= 25.0.0` (`node_modules/react-native/package.json:24`) |
| Expo CLI | `56.1.23` |
| Existing CI | `.github/workflows/codacy.yml` only. It uses `secrets.CODACY_PROJECT_TOKEN`. |
| GitHub metadata | Description mentions "AI tutor"; topics `[]`; homepage `null`; 0 releases; 0 tags; private vulnerability reporting `enabled: false` (`gh api`) |

## 3. Main technical findings

| # | File:line (at `b779d2d`) | Finding | Class | Pri | Fix | Acceptance | State |
| --- | --- | --- | --- | --- | --- | --- | --- |
| F1 | `docs/architecture/ARCHITECTURE.md:63-66,181`; `docs/SOURCE_OF_TRUTH.md` authority map | Describes the tutor, pairing and companion as implemented. `app/settings/pairing.tsx`, `app/tutor/index.tsx` and `companion/` do not exist; commit `8b38196` (2026-10-14) deleted them. | Incorrect | P0 | Mark as removed | No doc presents the tutor as available | Completed |
| F2 | `ARCHITECTURE.md:66`, `docs/requirements/SRS.md:96`, `docs/product/PRD.md` sections 5-6 | "No cloud inference client" and "zero outgoing requests". `core/ai/timetableParser.ts` calls Gemini; `app/_layout.tsx:25-45` starts Sentry. | Incorrect | P0 | Document both services | README privacy table matches code | Completed |
| F3 | `README.md` (old) step 2 | `npx expo start` leads to Expo Go. The app needs native modules not in Expo Go (`react-native-pdf`, `react-native-blob-util`, `expo-dev-client`). | Incorrect | P0 | Development-build steps | Commands exist in `package.json` | Completed |
| F4 | `app/_layout.tsx:25-45` | Sentry is always on: `tracesSampleRate` 0.2 in production, `replaysSessionSampleRate` 0.1, `replaysOnErrorSampleRate` 1.0. There is no off switch. Replay masking defaults are `true` in `@sentry/react-native` 7.11.0 (`dist/js/replay/mobilereplay.js:18-20`). | Implemented but poorly documented; owner decision | P1 | Disclose now; decide on an off switch | README states it | Docs completed; switch awaiting approval |
| F5 | `app/course/ai-setup.tsx` | The scan screen does not say that the photo goes to Google, or that free-tier inputs may be used by Google. Only the key screen (`app/settings/gemini-key.tsx:99`) names Google. | Partially disclosed | P1 | Add one line in the app before the first scan (app change) | Text visible on a device | Recommended for later |
| F6 | `docs/architecture/TECH_STACK.md:19` | Claims TanStack React Query. It is not in `package.json`, and no code imports it. | Incorrect | P1 | Remove the claim | Every row matches an import | Completed |
| F7 | `AGENTS.md` stack line | Says NativeWind styles the older screens. `grep className= app components` finds 0 files. | Outdated | P2 | Correct the line | Matches grep | Completed |
| F8 | `domains/attendance/repository.ts:2`, `domains/academic/snapshot.ts:107` | The portal snapshot is display-only. No code inserts into `portal_attendance`, so rows come only from a backup restore. | Partial | P2 | Mark as partial in README and SRS | Status shows "Partial" | Completed (docs) |
| F9 | `domains/ai/model.ts`, `core/db/backupSchema.ts`, `core/db/backupValidation.ts:26-29` | Five AI tables are unused but are required in backup format v2. | Requires owner decision | P2 | Staged plan in `docs/architecture/ERD.md` | Plan written; no schema change | Awaiting approval |
| F10 | `LICENSE` | Identical to `node_modules/expo/LICENSE` (`diff -q` reports no difference). Added in `ba243fa`. `package.json` has no `license` field; GitHub reports `MIT`. | Requires owner decision | P0 for promotion | Owner chooses holder and notice | Owner-approved notice | Awaiting approval |
| F11 | `.github/workflows/` | No CI ran tests or the typecheck. | Missing | P1 | `check.yml` | Local reproduction passes | Completed; remote run Not tested |
| F12 | Repository root | No CONTRIBUTING, CODE_OF_CONDUCT, SECURITY or CHANGELOG. | Missing | P2 | Add the first three | Files exist | Completed (no CHANGELOG: no release exists) |
| F13 | GitHub settings | Private vulnerability reporting is off. No security contact exists. | Requires owner decision | P1 | Owner enables it | `SECURITY.md` names a channel | Awaiting approval |
| F14 | `app.json:22` | Android package `com.anonymous.UniOS`. A later change creates a separate app that cannot update the first. | Requires owner decision | P1 before any store listing | Decide before the first public APK | — | Awaiting approval |
| F15 | `core/db/backup.ts:46` (`exportBackup`) | Backups hold database rows only, not uploaded files. | Implemented but poorly documented | P2 | State it in the README | Listed under Known limitations | Completed |
| F16 | `package.json` | `react-native-webview` and `punycode` have no import in app code. `markdown-it/lib/index.js:14` requires `punycode`. | Lead | P3 | Check peers, then remove `react-native-webview` if unused | `npm run check` plus a device build | Recommended for later |
| F17 | `package.json` `web` script | Web is not supported. On a clean `npm ci`, `npx expo export -p web` stops with "It looks like you're trying to use web support but don't have the required dependencies installed". | Verified | P2 | Say so in the README | — | Completed |

Assumptions: none were used for a claim in the docs. Where I could not check something, the docs say so (for example "no record of an iOS build" instead of "never built").

## 4. Important risks

| Risk | Effect | Mitigation |
| --- | --- | --- |
| Sentry session replay on a student app | Records screens. Masking is on by default, but this is not verified on a device for this app. | Verify on a device; offer an off switch (owner) |
| Gemini free tier | Google may use inputs to improve its products; human reviewers may read them ([Gemini API terms](https://ai.google.dev/terms)). | README warning; in-app line (F5) |
| LICENSE names Expo only | The ownership of UniOS code is unclear to outsiders. | Owner decision (section 13) |
| No device evidence | A promoted build may crash for the first users. | Device test plan (section 9) before promotion |
| Branch not pushed | The container is temporary. Local commits are lost when the session ends. | Owner approves a push of `chore/promotion-readiness` |

## 5. Files changed

| File | Why | State |
| --- | --- | --- |
| `README.md` | Rewritten in the requested 13-part structure. Each feature has a status and evidence. It has correct install steps, privacy disclosure, limitations and roadmap. | Completed |
| `AGENTS.md` | One line: NativeWind is configured but unused | Completed |
| `docs/product/PRD.md` | Tutor removed; journeys with status; external services and the open Sentry decision | Completed |
| `docs/requirements/SRS.md` | Section 3.7 marked removed; new section 3.8 for the scan (UNI-SCAN-001..004); UNI-ATT-002 partial; UNI-PRIV-001 conflict noted; `npm run check` in UNI-MAINT-001. Other statuses were not re-checked, and the file says so. | Partially completed |
| `docs/architecture/ARCHITECTURE.md` | Rewritten: real layers, scan sequence diagram, Sentry settings, data classification | Completed |
| `docs/architecture/TECH_STACK.md` | Rewritten from imports; React Query removed; unused packages listed | Completed |
| `docs/architecture/ERD.md` | AI tables marked unused; compatibility review and staged plan | Completed |
| `docs/SOURCE_OF_TRUTH.md` | Broken link `ai/local-companion-architecture.md` removed; companion row replaced by scan and Sentry rows | Completed |
| `docs/project-package/requirements-traceability-matrix.md` | Status note: FR-10 and FR-11 are inactive | Completed |

## 6. New files

| File | Content | State |
| --- | --- | --- |
| `CONTRIBUTING.md` | Setup, rules, tests, pull requests, bug reports | Completed |
| `CODE_OF_CONDUCT.md` | Short project-specific code. It is not the Contributor Covenant, because I did not have a verified copy of its text and attribution. | Completed |
| `SECURITY.md` | Scope, testing rules, and an interim channel. It states that the owner must enable private reporting. | Completed; channel awaiting approval |
| `.github/workflows/check.yml` | `npm ci` and `npm run check` on Node 22, `contents: read`, no secrets, 20-minute timeout | Completed |
| `audit/2026-10-17-promotion-readiness.md` | This report | Completed |

Not added: issue templates and a PR template. CONTRIBUTING covers the same fields. Add them after the first outside contributors appear. **Recommended for later.**

## 7. Commands run

| Command | Where | Result |
| --- | --- | --- |
| `git fetch origin master; git rev-parse origin/master` | repo | `b779d2d…` |
| `npm ci --no-audit --no-fund` | clean worktree at `7f40672`, Node 22.22.2 | exit 0, "added 1002 packages in 35s" |
| `npm run check` | same clean worktree | exit 0; Test Suites 42 passed of 42; Tests 379 passed of 379; Jest time 83.972 s; wall 1 m 34 s |
| `npx expo export -p web` | same clean worktree | exit 1. With proxy: "HTTP Proxy Network Error: Forbidden". With `EXPO_OFFLINE=1`: "CommandError: It looks like you're trying to use web support but don't have the required dependencies installed." |
| Link checker (Python, in session) | 12 changed docs | 0 missing files, 0 bad anchors, 0 missing cited paths |
| Secret grep on `git diff b779d2d..HEAD` (`AIza…`, `sentry.io`, `ghp_`, `sk-`, `password`, private keys) | repo | no matches |
| `git diff --name-only b779d2d..HEAD` excluding `.md` and `.github/` | repo | empty: no app code changed |
| `npm run check` at the final commit | repo | See section 8 |

Commit `f43b7f0` and this report change only Markdown. Section 8 records the final run.

## 8. CI configuration and status

- Workflow: `.github/workflows/check.yml`. It triggers on every push and every pull request.
- It does not duplicate checks: `npm run check` already runs `tsc --noEmit` and Jest, so the workflow has one step.
- The Codacy workflow is unchanged.
- **Remote status: Not tested.** The branch is not pushed, so GitHub has not run the workflow. The local reproduction above matches its steps.
- Final local run at this report's commit: recorded in the final reply to the owner.

## 9. Remaining device tests

| Test | Why |
| --- | --- |
| Fresh install of the preview APK starts without Metro | SRS UNI-REL-001 |
| Onboarding, add course by hand, mark attendance, schedule change and undo | Main flows (UNI-REL-002) |
| Airplane mode: every main flow works | Supports the offline claim |
| Gemini scan with a real key: camera and gallery, review, save | The Gemini call has no automated test |
| Sentry replay on a real screen: text and images masked | Privacy claim relies on SDK defaults |
| Report a problem arrives in Sentry with `diagnostics.md` | Disclosure accuracy |
| File viewers: PDF, video, audio, docx, xlsx, pptx on the device | Parsers are tested; rendering is not |
| Backup export, then restore on a second phone | Confirms the "files not included" limit |

## 10. Missing screenshots and demo assets

There are no real screenshots in the repository. `assets/Actual Assets.png` was not reviewed for this purpose. Web-harness renders from earlier sessions use stubs, so they are not real app screens and are not used. Screens to capture are listed in the README. Also needed: a 1280×640 social-preview image, made from real screenshots.

## 11. Proposed GitHub metadata (Awaiting approval; nothing changed)

| Field | Current | Proposed |
| --- | --- | --- |
| Description | "…attendance tracker, and AI tutor." | "Android app for university students: timetable, attendance with a skip budget, tasks and study files, stored on your phone." |
| Topics | none | `android`, `react-native`, `expo`, `student`, `attendance-tracker`, `timetable`, `sqlite`, `drizzle-orm`, `offline-first`, `education` |
| Homepage | none | Leave empty until a release exists |
| Releases | none | First release only after the device tests in section 9 |

Evaluation of "UniOS is an academic organizer for university students": accurate, but generic. The proposed text names the features that the code supports.

"Offline-first" is supported for storage: all records are in SQLite, and only Gemini and Sentry use the network. It is not device-verified. Use the topic, but avoid the claim in prose until the airplane-mode test passes.

**Strongest real differentiators** (from code):

1. Attendance maths that follow a real ordinance, including leave as not attended (`domains/academic/logic.ts`).
2. Schedule changes that never lose marks (`domains/calendar/marks.ts`, `__tests__/break_it.test.ts`).
3. A timetable from a photo with review before save.
4. In-app viewers for office files, with untrusted-input limits.
5. No account.

**Main barriers to trying UniOS:**

1. No APK or release to download.
2. No screenshots.
3. The `com.anonymous` package ID.
4. DCRUST-specific rules.
5. Sentry always on.
6. An unclear license.

## 12. Thirty-day organic growth plan (Recommended for later; nothing published)

Rules checked on 2026-10-17 with web search:

- r/androidapps moved all developer self-promotion to r/droidappshowcase. Its moderators announced zero tolerance in the main sub (moderator post of 2026-05-27, read through a mirror).
- r/reactnative runs a weekly "Show Your Work" thread for projects.
- Reddit's 9:1 self-promotion ratio is a guideline that some subreddits adopt, not a site-wide rule.
- GitHub allows at most 20 topics per repository ([GitHub Docs](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/classifying-your-repository-with-topics)).

Read each community's current sidebar again before posting.

| Week | Channel | Audience | Action | Preparation | Effort | Metric | Next step |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Classmates (DCRUST, own section) | 5–10 students | Install the preview APK; watch them set up the timetable | Device tests pass; owner decisions on LICENSE, package ID, Sentry | 4 h | Installs; setup completed without help; crashes in Sentry | Fix the top 3 problems |
| 1 | GitHub repo | Visitors | Apply description and topics; add screenshots | Real screenshots | 1 h | GitHub traffic (views, clones) | Compare in week 4 |
| 2 | GitHub release | Testers | Publish v1.1.x APK with notes and known limits | Week 1 fixes; CHANGELOG | 2 h | Release downloads | Ask testers for issues |
| 2 | DCRUST student groups the owner belongs to | DCRUST B.Tech students | One honest post: what it does, limits, link to release | Release exists; rules of the group | 1 h | Installs, issues, messages | Reply to every report |
| 3 | r/reactnative "Show Your Work" thread | React Native developers | Comment with the architecture (synchronous transactions, mark reconciliation) | README and docs final | 1 h | Comments, stars, contributor interest | Turn questions into docs |
| 3 | r/droidappshowcase | Android users | One post following that sub's rules | Screenshots, release | 1 h | Downloads in that week | Stop if no fit |
| 4 | Dev.to or Hashnode article | Developers | "Counting attendance by the ordinance" technical write-up | Code examples from `logic.ts` | 4 h | Reads, referral traffic | Link from README if useful |
| 4 | Review | — | Compare metrics; list repeat users (testers still marking after 2 weeks) | Week 1–3 data | 1 h | Repeat users, issues, PRs | Plan month 2 |

No paid stars, fake reviews, bulk messages or posts that pretend to be a user.

## 13. Unresolved owner decisions

| Decision | Options | Blocks |
| --- | --- | --- |
| LICENSE copyright holder | Expo's notice must stay for any Expo-derived material that is copied in. For UniOS's own code: the holder's name (for example "Harsh Sharma"), the years, and whether to keep MIT. At `b779d2d`, 43 of 94 commits have the author name "Claude" (`git log --format=%an`); the owner may want legal advice on the authorship of AI-assisted code. | Promotion |
| Inherited files | The first commit `ba243fa` had template-style files (`App.tsx`, default icons in `assets/`). `App.tsx` no longer exists. Whether `assets/icon.png` and the splash images come from the Expo template is UNVERIFIED: no template copy is available offline. | License notice |
| Sentry | Keep as is, add an off switch, turn off replay, or remove | Privacy claims |
| Security contact | Enable GitHub private vulnerability reporting, or give an email | `SECURITY.md` |
| Android package ID | Keep `com.anonymous.UniOS` or choose a final ID before the first public APK | Release |
| Unused AI tables | Approve the staged plan in the ERD, or keep the tables | Schema cleanup |
| Push | Push `chore/promotion-readiness` so it survives the session and CI runs | Remote CI evidence |
| GitHub metadata | Apply section 11 | Discoverability |

## 14. Prioritised next steps

1. P0: Owner decides on LICENSE (Awaiting approval).
2. P0: Owner approves a push of this branch; observe the remote CI run (Awaiting approval).
3. P1: Run the device tests in section 9; capture screenshots (Not tested).
4. P1: Decide on Sentry and the security contact (Awaiting approval).
5. P1: Add the in-app Gemini disclosure on the scan screen (Recommended for later; app change).
6. P2: Package ID, then the first GitHub release with a CHANGELOG (Awaiting approval).
7. P2: Apply GitHub metadata (Awaiting approval).
8. P3: Check `react-native-webview` and NativeWind for removal (Recommended for later).

## 15. Reviewable diff

Run `git diff b779d2d..chore/promotion-readiness` on the branch. The final reply links the full diff file.
