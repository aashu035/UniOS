# Owner decisions: license, security reporting, package ID, GitHub metadata

| Field | Value |
| --- | --- |
| Status | **Facts and options only. Nothing here is changed. Each item waits for owner approval.** |
| Date | 2026-10-17 |
| Baseline | `master` at `b779d2d` |

Labels: **Verified** (checked with the command or file shown), **Unverified** (could not be checked here), **Owner decision**.

## 1. License and attribution

`LICENSE` is unchanged. Git author names are not treated as proof of copyright.

### 1.1 Facts

| # | Fact | Evidence | Label |
| --- | --- | --- | --- |
| L1 | `LICENSE` is the MIT text with "Copyright (c) 2015-present 650 Industries, Inc. (aka Expo)". | `LICENSE:1-3` | Verified |
| L2 | It is byte-identical to the license of the `expo` package. | `diff -q node_modules/expo/LICENSE LICENSE` printed no difference | Verified |
| L3 | It arrived in the first commit, `ba243fa` (2026-07-30, "Initial commit for EAS build"). That commit also added app code, for example `app/(main)/home.tsx` (237 lines) and `app/onboarding.tsx` (148 lines). | `git show --stat ba243fa` | Verified |
| L4 | The first commit's `assets/icon.png` was Expo's default template icon: the blue Expo "A" mark on a blueprint grid. | Visual check of `git show ba243fa:assets/icon.png` | Verified (visual) |
| L5 | All six template images were replaced in `89573c4` (2026-08-20). `icon.png` was also changed in `1637779` and `533a09e`. None of the current images matches a PNG in `node_modules` (SHA-256 compared). | `git log -- assets/<file>`; hash comparison | Verified |
| L6 | `App.tsx` and `index.ts` from the first commit were deleted in `d562749`. | `git log --diff-filter=D -- App.tsx index.ts` | Verified |
| L7 | No tracked file outside `LICENSE` and `package-lock.json` has a copyright line, an `@license` tag or an SPDX header. No fonts and no `vendor/` or `third_party/` folders are tracked. | `git grep -lIE "Copyright \(c\)\|@license\|SPDX-License-Identifier"`; `git ls-files` | Verified |
| L8 | `package.json` has `"private": true` and no `license` field. GitHub reports the repository license as `MIT` (from the `LICENSE` file). | `package.json`; `gh api repos/aashu035/UniOS` | Verified |
| L9 | Third-party code reaches users only through npm dependencies. The lockfile lists 759 non-dev packages: MIT 612, ISC 37, Apache-2.0 23, MPL-2.0 23, BSD-3-Clause 21, and others. Some are build tools that are not shipped in the APK (for example `@sentry/cli`, FSL-1.1-MIT; `lightningcss`, MPL-2.0). | Node script over `package-lock.json` | Verified (counts); which packages ship in the APK: Unverified |
| L10 | The two font packages are `MIT AND OFL-1.1`. Their fonts are bundled into the app. | `node_modules/@expo-google-fonts/*/package.json` | Verified |
| L11 | `@google/genai` is Apache-2.0. | its `package.json` | Verified |
| L12 | The current app icon (`assets/icon.png`, the Android icon layers and the splash image) is a photograph of a "श्री राधा" (Shri Radha) emblem on flowers. Who took the photograph, and who holds its rights, is not recorded. | Visual check; `git log -- assets/icon.png` | Verified (content); rights: Unverified |
| L13 | `assets/Actual Assets.png/` is a folder with six 1 MB images of app screens. They show an iOS status bar (9:41) and text that does not exist in the code ("Academic Weather", "vs last month": `grep` finds no match). They are design mockups, not screenshots. Their source and rights are not recorded. | Visual check; `grep -rln` in `app components domains` | Verified (mockups); rights: Unverified |
| L14 | `assets/*.svg`, `assets/embedded_systems.png` and `assets/logo.jpg` are not referenced by app code or `app.json`. Their source is not recorded. | `grep` in `app components core domains app.json app.config.js` | Verified (unused); source: Unverified |
| L15 | 43 of 94 commits at `b779d2d` carry the author name "Claude". The rest carry "Harsh". Author names do not establish who holds copyright. | `git log --format=%an` | Verified (counts only) |

### 1.2 What belongs to whom (as far as the repository shows)

| Material | Origin | Notice that must stay |
| --- | --- | --- |
| `LICENSE` text and copyright line | Copied from Expo's MIT license (L2) | Keep Expo's notice only for Expo material that is still in the repository. L5 and L6 show that the template images and template entry files are gone. Whether any template configuration remains (`babel.config.js`, `tsconfig.json`, `.gitignore`) is a judgement for the owner. These are short configuration files. |
| App source in `app/`, `components/`, `core/`, `domains/`, `drizzle/`, `__tests__/` | Written in this repository (L3, L7). AI-assisted for part of the history (L15). | The owner's chosen notice |
| npm dependencies | Their own licenses (L9-L11) | Their notices. For distributed builds, the MIT license itself says the notice "shall be included in all copies or substantial portions of the Software". |
| App icon photograph | Unknown (L12) | Unknown until the owner confirms the source |
| Mockups and unused images | Unknown (L13, L14) | Unknown until the owner confirms the source |

### 1.3 Decisions for the owner

1. **Copyright holder** for the original UniOS code: for example "Harsh Sharma", with a start year (the first commit is 2026). Whether contributors keep their own copyright (common) or assign it.
2. **License:** keep MIT, or choose another. A change affects people who already copied the code under MIT.
3. **Expo notice:** keep it next to the new line (safe), or remove it after deciding that no Expo template material remains.
4. **AI-assisted code:** whether to state in the README or CONTRIBUTING how AI tools are used. Get legal advice if ownership of AI-assisted code matters to you. This report does not give legal advice.
5. **Icon photograph:** confirm who took it and that you may use it. The promotion brief said "Do not add personal or religious branding to the product". The current icon is a religious emblem, so decide whether UniOS keeps this icon in public builds.
6. **Mockups and unused images:** confirm their source, then keep, move to a design folder, or delete.
7. **Third-party notices in the app:** decide whether to add an "Open-source licenses" screen generated from a real build.

## 2. GitHub private vulnerability reporting

| Fact | Evidence | Label |
| --- | --- | --- |
| The setting is **off**. | `gh api repos/aashu035/UniOS/private-vulnerability-reporting` returned `{"enabled":false}` on 2026-10-17 | Verified |
| The repository is public and owned by a user account. The session's token has admin permission. | `gh api repos/aashu035/UniOS` → `visibility: public`, `owner.type: User`, `permissions.admin: true` | Verified |
| Where to turn it on | Repository **Settings → Advanced Security** (under "Security" in the sidebar) → **Private vulnerability reporting → Enable**. | [GitHub Docs](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/configuring-private-vulnerability-reporting-for-a-repository) |
| What reporters see | A **Report a vulnerability** button on the repository's Advisories page. They can also report through the REST API. | Same page |
| Who is notified | Administrators and security managers who watch the repository for all activity, or who subscribe to "Security alerts". | Same page |
| Limits | The reporter must use GitHub. The owner must watch the repository, or the report can go unnoticed. The search did not show any public-only restriction. I could not open the page itself. | Search summary of GitHub Docs; Unverified for edge cases |

After the owner turns it on, `SECURITY.md` should replace its "Owner action needed" paragraph with "Use the **Report a vulnerability** button on the Security tab". No personal email is needed.

## 3. Android package ID

### 3.1 Current state

| Item | Value | Evidence |
| --- | --- | --- |
| Production and preview ID | `com.anonymous.UniOS` | `app.json:22` |
| Development ID | `com.anonymous.UniOS.dev`, derived as `${package}.dev` | `app.config.js:20` |
| iOS development bundle ID | Hard-coded as `'com.anonymous.UniOS.dev'` | `app.config.js:27` |
| Version | `1.1.0`, `versionCode` 4 | `app.json:6,14` |
| Version source | `"appVersionSource": "remote"`, with `autoIncrement` for preview and production. EAS keeps the build number on its servers. | `eas.json:4,25,34` |
| Releases | No GitHub release and no tag. A Play Store listing is not linked anywhere in the repository. | `gh api …/releases` returned `0` |
| Installed copies | `AGENTS.md` and `app.config.js:5` describe a preview APK "you use daily", so at least one phone has `com.anonymous.UniOS` installed. | Text in the repository; the number of installs is Unverified |
| EAS builds | Not checked. The Expo MCP server did not connect in this session. | Unverified |

### 3.2 The candidate `com.harshsharma.unios`

| Check | Result |
| --- | --- |
| Format | Valid: three lowercase segments that start with letters. |
| Convention | A reverse domain name. It suggests the domain `harshsharma.com`. Whether you own that domain is Unverified. |
| Identity | It puts your personal name in the product's permanent ID. The promotion brief keeps "Harsh Sharma" (professional identity) separate from "UniOS" (product). Alternatives: a domain you own for UniOS, or `io.github.aashu035.unios`. The GitHub-based ID depends on the username staying the same. |
| Uniqueness | Only the Play Console can confirm that the ID is free. |

### 3.3 Risks of changing the ID

| Risk | Detail | Label |
| --- | --- | --- |
| A new app, not an update | Android treats a different application ID as a different app. The new build installs next to the old one. It cannot read the old app's data. Several community sources also say the Play Store treats a new ID as a new listing. I did not find Google's own page in this session. | Android behaviour: well established; Play wording: Unverified |
| Data migration | Students must **Backup & export** in the old app, then restore in the new one. Uploaded files are not in the backup (`core/db/backup.ts` exports rows only), so they are lost. The Gemini key in SecureStore does not move. | Verified from code |
| Dev variant | `app.config.js:27` hard-codes the iOS dev ID. It must change at the same time. | Verified |
| EAS | Credentials and the remote version counter may be tied to the application ID. Check with `eas credentials` before the change. | Unverified |
| Sentry | Release names and filters may include the ID. Check the Sentry project after the first build. | Unverified |
| Best time | Before the first public APK or store upload. Later, every existing user needs the manual migration. | — |

A change touches only `app.json:22` and `app.config.js:27`, plus docs that name the ID. It needs a new development build and a new preview build.

## 4. GitHub description and topics

Proposed description (123 characters):

> Android app for university students: timetable, attendance with a skip budget, tasks and study files, stored on your phone.

| Topic | Why it fits | Evidence |
| --- | --- | --- |
| `android` | The only configured platform | `app.json` `android`; no iOS bundle ID |
| `react-native` | UI framework | `package.json` `react-native` 0.85.3 |
| `expo` | Runtime, router and build | `package.json` `expo` ~56.0.19; `eas.json` |
| `student` | Target user | README, PRD |
| `attendance-tracker` | Main feature | `domains/academic/logic.ts` |
| `timetable` | Weekly classes, schedule changes, AI scan | `domains/calendar/`, `domains/timetable/` |
| `sqlite` | Local storage | `expo-sqlite`, `core/db/client.ts` |
| `drizzle-orm` | Schema and migrations | `package.json`, `drizzle/` |
| `offline-first` | All records in SQLite; network only for Gemini and Sentry. An airplane-mode device test is still pending. | `ARCHITECTURE.md` data classification |
| `education` | Subject area | — |

Not proposed: `ai`, `gemini` or `ai-tutor`. The tutor is removed, and the scan is optional. Advertising AI would overstate it. Add `gemini` later if you want the scan to be discoverable.
