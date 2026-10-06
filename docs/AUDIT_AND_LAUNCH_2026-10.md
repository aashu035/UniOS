# UniOS: audit, open risks and launch plan (6 Oct 2026)

Scope: all code written in the Claude Code session from 30 Sep to 6 Oct 2026 (~4,700 lines in 45 files: the redesign, attendance, setup, diagnostics, AI import, timetable grammar), plus the pre-existing AI timetable import that the session touched.

## 1. Bugs found and fixed

| # | Severity | Bug | Fix (commit) |
|---|---|---|---|
| 1 | **Critical** | Percentages rounded up: 149/200 = 74.5% showed **75%**, i.e. "safe" while below the detention line. | Every percentage now rounds down (`pctOf`, canonical engine) (`55fdb44`) |
| 2 | **Critical** | AI timetable import kept only the **first** slot of each course and stored "01:00 PM" where the app expects "13:00". | `planImport`: every slot, parts, 24-hour times, per-course isolation (`01a8ecb`) |
| 3 | High | Leave counted as attended, unlike the portal and ordinance clause 9. | Leave is held but not attended; condonation note (`0e6ba3f`) |
| 4 | High | Cancelling a class for a day left its present/absent mark counting. | Mark becomes Off and remembers the old status; restore brings it back (`01a8ecb`) |
| 5 | High | Changing an old mark could show `SECURITY_VIOLATION: Occurrence rec_…`. | Existing marks update in place; readable message otherwise (`01a8ecb`) |
| 6 | High | Android showed only 3 of 6 mark options (Alert.alert limit), so Off and Delete were missing. | Mark sheet (`4d76b07`, redesigned in `63c469a`) |
| 7 | Medium | Dates like 30 Feb or 31 Apr were accepted. | Real month lengths (`55fdb44`) |
| 8 | Medium | Undo of "Remove mark" on a cancelled class failed. | Cancelled slots accept a mark (`55fdb44`) |
| 9 | Medium | Gemini model hard-coded (`gemini-2.5-pro`, retired for new keys). | Fallback chain + ListModels discovery (`78ac49c`) |
| 10 | Medium | Setup grid stopped at 5 PM; a 4 PM lab was refused. | 8 AM–7 PM, either layout (`78ac49c`) |
| 11 | Medium | Credits silently defaulted to 3 (setup, old add form, edit). | Suggested from L+T+P/2, required in Edit (`0e6ba3f`, `e7c7f91`) |
| 12 | Low | Today card said "Marked absent" for a class on leave; report screen overclaimed privacy; scan errors shown as raw JSON. | Fixed (`01a8ecb`, `78ac49c`, `55fdb44`) |

**How the tests changed:** `__tests__/adversarial.test.ts` and the "attack" block in `academic_snapshot.test.ts` were written to make the app fail. 14 of 22 failed on first run and were fixed in the code, not in the tests. The suite (158 tests) now always runs in India time and also passes in UTC−8 and UTC+14.

## 2. Open risks (not fixed: need a decision, a device, or more time)

1. **Package name `com.anonymous.UniOS`.** The package ID can never change after the app is published on Play.
   - Pick the final one now, e.g. `in.unios.app`.
   - Changing it installs as a new app, so export your data first.
2. **Target API.** New apps and updates must target **API 36 (Android 16)** since 31 Aug 2026; an extension to 1 Nov 2026 is available.
   - Expo SDK 56's default target needs checking in a built APK.
   - SDK 57 also fixes the Hermes memory regression that `expo-doctor` reports.
3. **Sentry for a public release.** `profilesSampleRate: 1.0` and 10% session replay will use the free Sentry quota quickly.
   - Both must be declared in Play's Data safety form and in a privacy policy.
   - Lower them for `production`.
4. **Data is only on the phone.** Uninstalling wipes it.
   - Backup & export exists, but there's no automatic backup.
   - Android Auto Backup of the SQLite file, or an optional cloud backup, would be the cheapest real protection.
5. **Old screens still in the repo** and partly reachable:
   - `app/workspace/[id]/attendance.tsx`, `app/course/attendance.tsx`, `app/course/add.tsx`
   - the hidden `workspaces` and `semester` tabs
   
   Delete them once nothing links to them, to remove two sources of truth.
6. **The course page loads the whole database twice** (snapshot + semester history). This is fine now, but slow after a few semesters. A per-course query would fix it.
7. **The AI import names courses by their code** ("SC"). It should read the legend under the timetable through `domains/timetable/grammar.ts`; see the plan in §3.
8. **Samarth portal integration.**
   - Login must happen in an in-app WebView where the student types their own password. The app never stores or sends it.
   - Automated access to the portal may be against university rules. Keep it read-only and user-initiated, and ask the university if you go public.
9. **Not yet verified on a phone:**
   - the new Attend tab, mark sheet, Edit course and setup grid
   - the dev build itself
   - EAS `autoIncrement` with `appVersionSource: remote` (the first build adopts versionCode 4)

## 3. UX improvements, in priority order

1. **Week-grid setup instead of per-course painting.**
   - Set the period times once (DCRUST: 8:00–8:55 … 5:00–5:55).
   - Days down the side, periods across.
   - Tap a cell to pick the course and part; a lab fills 2 periods.
   - Your section and group are asked once.
   - All courses are created in one go, with their names and codes from the legend.
2. **Share a section's timetable.** One student publishes Section A; classmates scan a QR code, pick CSE-1/2/3, and are done. No key and no recognition errors. This is also the best way to grow the app (WhatsApp groups).
3. **Scanning without a key.** On-device text recognition (ML Kit) feeds `grammar.ts`. The result opens in the week grid as a draft, with unsure cells highlighted. Gemini stays as an option for better accuracy, with guided key setup.
4. **Mark in one tap from a notification** at class end: Present / Absent buttons, as the handoff suggests.
5. **Home-screen widget:** today's classes plus the riskiest course.
6. **Portal comparison:** list exactly which dates differ between your log and the portal, to resolve disputes with the teacher before the semester ends.
7. **Leave tracker:** documents submitted (yes/no) and the date. The 7-day deadline (clause 9.4) gives a reminder.
8. **Onboarding in under 60 seconds:** pick your college → section → group (from a shared timetable) → done.

## 4. Launch on Google Play

- **Account:** a personal account must run a **closed test with at least 12 testers opted in for 14 continuous days** before production. If the count drops below 12, the 14 days restart. Classmates are the natural testers.
- **Store requirements:**
  - privacy policy URL
  - Data safety form (Sentry crash data, optional diagnostics, local storage)
  - content rating
  - target API 36
  - 512 px icon, feature graphic, phone screenshots
- **Store listing:**
  - Name: "UniOS – Attendance & Timetable".
  - Lead with the outcome: "Know exactly how many classes you can skip. Built on the 2024-25 B.Tech ordinance."
  - Keywords: attendance tracker, bunk calculator, 75% attendance, timetable, DCRUST.
- **Competition:** RollCall, Bunk Mate, AttendMate and Attendance Viewer are free, and some are ad-free. Charging up front won't work.
  - What sets UniOS apart:
    - leave and condonation counted by the actual rules
    - theory, lab and tutorial tracked separately
    - comparison with the portal
    - timetable scanning that handles groups
    - timetable sharing for a whole section
- **Money:**
  - **Free:** attendance, timetable, tasks.
  - **Pro (about ₹49–99 a year or ₹149 once):**
    - cloud backup and sync
    - timetable scan without your own key
    - widgets
    - portal comparison
    - exam planner
  - Avoid ads; they cost trust in a tool students rely on for detention decisions.
  - A free "share with your section" feature does the marketing.

Sources: [Play closed testing rule](https://www.testerscommunity.com/blog/google-play-closed-testing-requirements-2026), [Play target API requirement](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en-419), [API 36 deadline and extension](https://ecorpit.com/android-target-api-36-play-store-deadline-migration-2026/), competitors: [RollCall](https://www.producthunt.com/products/rollcall-attendance-tracker/reviews), [Bunk Mate](https://github.com/Bunk-Mate/Mobile-App), [Attendance Viewer](https://f-droid.org/packages/com.juet.attendance).
