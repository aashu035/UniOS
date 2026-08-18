# R0 — Physical Product Reality Matrix

| Workflow | Physical Expectation | Actual Result | Evidence | Status |
|---|---|---|---|---|
| **Onboarding** | Profile exists and survives app restart | Onboarding completed successfully with **Harsh / Computer Science / Semester 5**, and the app entered Home. Survival after a complete restart has not been explicitly verified. | Device test: profile setup completed and Home displayed `Today, August 17, Monday`. | **PENDING** |
| **Add Course** | Course appears immediately on Home / Workspace | Course creation was possible and courses appeared under **Courses & Semester**, but downstream screens did not consistently consume the saved configuration. | Physical testing: courses were visible in More → Courses & Semester, while Home/Timetable behavior was inconsistent. | **FAIL** |
| **Theory + Lab** | Both components are distinctly visible in course list | User configured **Theory + Lab**, but the resulting course behaved/displayed as only a theory lecture. Lab configuration was not represented correctly in the course UI. | Physical report: “I have added lab plus theory, and it is also only adding a theory lecture.” | **FAIL** |
| **Faculty Display** | Correct faculty name displayed in course details | Course setup contained faculty information, but Course Detail displayed **“No instructor set.”** | Physical report: configured faculty (`Dr. RD`), then course showed “No instructor set.” | **FAIL** |
| **Venue Display** | Correct venue displayed in course details | Configured venue was not reflected in Course Detail/Edit UI. | Physical report: venue was entered during setup but Edit Course did not show it. | **FAIL** |
| **Scheduling** | Two classes on the same day both appear on timetable | **Only one** of two courses scheduled for the same day appeared in the timetable/Home schedule. Both existed under Courses & Semester. | Physical report: “I added two courses which are to be scheduled for today, but it only showed me one.” | **FAIL** |
| **Attendance (UI)** | “Mark Present” button is available for today's classes | No usable attendance-marking mechanism was initially available; the user reported that Attendance provided no way to mark attendance. | Physical report: “Attendance… provide nothing, nothing, a single bit of option to user to mark their attendance.” | **FAIL** |
| **Attendance (Math)** | “Target 75%” does not masquerade as “Actual 75%” | Course attendance displayed the **75% target** rather than actual attendance when no attendance data existed. | Physical report: “it still showing me the 75 targeted attendance instead of showing a real attendance.” | **FAIL** |
| **Task Creation** | New task appears in task list | **Not physically verified in the evidence currently available.** | No explicit device result supplied. | **PENDING** |
| **Task Completion** | Status persists after checking it and restarting app | **Not physically verified.** Earlier forensic audit identified non-persisted task toggling, but that is code evidence rather than current physical evidence. | No post-fix physical restart test supplied. | **PENDING** |
| **Course Editing** | Existing values prefill correctly when opening edit screen | Existing course identity appeared, but faculty/venue were missing and the configured component structure was not represented correctly. | Physical report: Edit showed course name/code/75% attendance, but faculty and venue were absent. | **FAIL** |
| **Navigation** | Settings route opens correctly | Initially **failed** with `Unmatched Route: App could not find UniOS`, followed by the `SystemInfo → origin of undefined` JavaScript exception. A later fix was implemented, but post-fix physical verification has not yet been supplied. | Device error + stack trace: `TypeError: Cannot read property 'origin' of undefined` at `SystemInfo`; later `app/settings/index.tsx` was created. | **PENDING** |

---

# R1 — Feature Contract Matrix

| Feature | Implemented? | Persisted? | Read back? | Editable? | Deleted Correctly? | Survives Restart? | Status |
|---|---|---|---|---|---|---|---|
| **Workspace/Course** | Yes | Yes — verified by Phase B.5 | **Partially / previously broken**; current read path was rectified | Identity editing exists | Previously verified | Not physically verified | **PENDING R0** |
| **Theory/Lab Components** | Yes | Yes — Phase B.5 verified DB persistence | **Previously broken physically**; current implementation needs device verification | Component editing not fully established | Not fully verified | Not physically verified | **FAIL → R2 required** |
| **Faculty Assignment** | Yes | Yes — Phase B.5 verified | **Previously broken physically**; new `getCompleteWorkspace()` claims rectification | Historical assignment infrastructure exists; UI completeness unclear | Not fully verified | Not physically verified | **FAIL → R2 required** |
| **Venue Assignment** | Yes | Yes — Phase B.5 verified | **Previously broken physically**; new read path claims rectification | Historical venue infrastructure exists; UI completeness unclear | Not fully verified | Not physically verified | **FAIL → R2 required** |
| **Recurring Schedule** | Yes | Yes | Phase B.5 verified through `CalendarService` | Course Builder creates schedules | Exceptions have domain support | Not physically verified | **FAIL → R0 regression required** |
| **Attendance Records** | Yes | Yes — Phase B.5 verified | Yes — calculation tested | Marking flow rectified for multi-component case | Cancellation semantics tested | Not physically verified | **FAIL → R0 regression required** |
| **Tasks** | Yes | Yes — Phase B.5 Test 8 verified status persistence | Yes | Repository supports updates; UI completeness still needs verification | Not fully verified | Not physically verified | **PENDING R0** |

---

# Next Step: Controlled R0 Testing

**Target Protocol:**
1. Create ONE known course:
   * **Embedded System** (Code: `ESECE301D`, Credits: `4`)
   * **Theory**: Dr. RD, JCB 213, Monday 09:00–10:00
   * **Lab**: Dr. XYZ, Lab X, Wednesday 14:00–16:00
2. Execute this exact chain and record what appears:
   * `Course Builder → Review → Save → Home → Courses & Semester → Open Embedded System → Course Overview → Edit Course → Timetable → Attendance → Restart APK → Repeat`
