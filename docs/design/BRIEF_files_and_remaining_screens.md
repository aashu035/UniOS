# Claude Design brief: files, viewers and the remaining screens

Paste this into the existing Claude Design project (the one with `UniOS App.dc.html`,
`uni.js`, `unidata.js`). Extend that file. Do not start a new visual language.

## Who and what
UniOS is an offline-first Android app for B.Tech students at DCRUST. Everything lives
on the phone. Users are 18–22, mostly on mid-range Android phones (360–412 dp wide),
often one-handed, often on patchy data. Copy is plain English, short, never cute.

## Use what already exists
- Tokens (light / dark):
  - bg `#F5F6F8` / `#09090B`
  - elev `#FFFFFF` / `#18181B`
  - surface `#EEF0F4` / `#27272A`
  - text `#111827` / `#FAFAFA`
  - muted `#6B7280` / `#A1A1AA`
  - primary `#1d61e7` / `#3B82F6`
  - success `#16A34A`
  - danger `#DC2626`
  - warn `#D97706`
  - leave `#0891B2`
- Fonts: Plus Jakarta Sans (400–800); JetBrains Mono for numbers and times.
- Components already built: LargeTitle, Card, ListCard, Chip, Pill, Segmented, RoundButton, Well (icon tile), Ring, Empty state, bottom TabBar with the centre + button, and the bottom sheet used by the Mark sheet. Reuse them.
- Icons: lucide.
- Every screen needs light and dark versions.
- **Never** design a dialog with more than 3 buttons. Android drops the rest; use a bottom sheet instead.

## 1. The + Add sheet (like ChatGPT's attach menu)
Opened from the + in the tab bar ("Upload file", "Add a note") and from a course's Files tab.

Options, each with an icon tile:
- Camera
- Photos
- Files
- Link
- Note

Under each option, one muted line saying where it goes:
- Photos: "Your gallery and Google Photos"
- Files: "Phone storage, Downloads, Drive"

These open Android's own pickers. Design only the sheet and what happens after picking, not the pickers themselves.

### After picking: "Add to UniOS" review sheet
Shows a list of everything picked: photos, videos and files can be mixed, and there can be several. Each row has:
- a thumbnail for photos and videos, or a coloured type tile (PDF red, Word blue, Excel green, PowerPoint orange, audio purple, other grey)
- the name, which can be renamed inline
- the size and type
- a remove (×) control

Below the list, the course to save into:
- chips with the course short names plus "General"
- preselected when opened from a course

States to design:
- **Copying:** progress per file and overall. Big videos take time, so show the real size, e.g. "Copying 412 MB of 1.2 GB".
- **Large file warning** (over 500 MB): "This video is 1.2 GB. It will be copied into UniOS and use that much space."
- **Duplicate:** "Already saved in OS as 'Unit 3 notes'". Offer "Add anyway" and "Skip".
- **Can't read a file** (cloud file not downloaded, permission lost): mark the row in red with a reason. The other files still save.
- **Phone storage full.**
- **Camera:** multi-shot for photographing several pages of notes, a thumbnail strip, and "Done (5)". Optional: "Save as one PDF".
- **Camera permission denied:** explain why the camera is needed, with an "Open settings" link.

## 2. Viewers (one shared frame, one body per type)
**Shared top bar:**
- back button
- title (2 lines max) and course chip
- ⋯ menu as a sheet:
  - Open in another app
  - Share
  - Rename
  - Move to course
  - Delete (with undo snackbar)
- The bar hides on tap for full screen.

**Shared states:**
- **Loading:** a skeleton with the file type tile.
- **"This file isn't on this phone":** backups keep file names, not files. Offer "Remove from list".
- **"Can't open this file":** show the file card (type tile, name, size), with "Open in another app" and "Share".
- **"No app on this phone can open it":** suggest an app for the file type.

**Per type:**
1. **Photo:**
   - pinch and double-tap zoom
   - swipe between the photos of the same course, with a 3 / 12 counter
   - works for any aspect ratio (tall screenshots, wide panoramas)
   - rotate button
2. **Video:**
   - fits any aspect ratio (portrait reels, landscape lectures)
   - full screen turns to landscape
   - play/pause, ±10 s, scrubber with time, speed 0.5/1/1.25/1.5/2×
   - "Resume from 12:40?" chip when reopened
   - optional bookmarks with a label ("Derivation starts")
   - unsupported format (old AVI/WMV) shows the "Can't open" state
3. **Audio** (lecture recordings):
   - big play button, scrubber, ±15 s, speed
   - remembers position
   - keeps playing with the screen off (show the media notification style)
4. **PDF:**
   - page X of Y, tap to jump to a page
   - continuous vertical scroll
   - pinch zoom
   - dark mode that inverts pages (toggle)
5. **Word (.docx)** (simplified reading view):
   - headings, paragraphs, lists, tables and images in UniOS type
   - slim banner: "Simplified view. Open in Docs for the exact layout." with an Open button
6. **Excel / CSV:**
   - sheet tabs
   - frozen first row and first column
   - horizontal scroll
   - tap a cell to see its full value in a sheet
   - long sheets: show the first 1,000 rows, then "Open in Sheets for the rest"
7. **PowerPoint (.pptx)** (simplified):
   - one card per slide: title, bullet text, images, speaker notes collapsed
   - swipe or scroll between slides, slide 4 / 18
   - same "Simplified view" banner
8. **Text, code, Markdown, JSON:** readable type, monospace for code, wraps long lines.
9. **Link:**
   - card with the site name, URL and "Open in browser"
   - copy link
10. **Note:**
    - title and body editor (Markdown), autosave indicator ("Saved")
    - shown in reading mode first, with an Edit button

## 3. Add task / Edit task (one screen, two modes)
**Fields:**
- Task name (required)
- Type chips: Assignment, Quiz, Lab file, Exam, Other
- Course chips plus General (preselected when opened from a course)
- Due date with a quick row (Today, Tomorrow, Next class of this course, Pick date), and an optional time
- Priority: Low, Medium, High
- Notes

**States and behaviour:**
- **Edit mode:** a Mark done / Mark not done toggle, and a Delete row (two taps to confirm, like Delete course).
- **Validation:** an empty name, or a due date in the past (allowed, but labelled "Already late").
- **Opened from a course:** the course can't be changed silently. It's a chip the user can tap to change.

## 4. Profile and Edit profile
- **Header:** photo (tap opens a sheet with Camera, Photos, Remove), name, branch, enrollment number, and the current semester (from the active semester).
- **Edit fields:** name, branch, enrollment number, target CGPA.
  - Validation messages (from the app): "Check your name", "Check enrollment number", "Check target CGPA (0–10)".
- **Links:** Backup & export, Semesters.
- Keep it short. This is not a dashboard.

## 5. Semesters
- **List:** one card per semester, showing number and name, Odd/Even, dates, SGPA, and an Active badge.
  - Actions in a sheet: Set active, Edit, Delete.
  - Delete is blocked while the semester has courses: "Move or delete its 6 courses first".
- **Add/Edit:** number (required), custom name, Odd/Even, start date, end date, SGPA (optional, 0–10).
- **First semester:** the empty state explains that courses belong to a semester.

## 6. Search
- One field, focused on open.
- Results grouped: Courses, Tasks, Files, Notes. Each row shows its course chip and a type icon.
- Matched text is highlighted.
- Recent searches (clearable).
- "No matches for '…'" with a hint ("Try a course code like CSE-301").

## 7. Onboarding (first launch)
- Three short steps:
  1. Welcome, with the privacy line: "Everything stays on this phone."
  2. Name and branch.
  3. Current semester number and dates. This creates the first semester.
- A progress dots row and a back button.
- Ends on "Add your first course" with a secondary "Do it later".

## 8. Timetable scan (AI) and its key screen
**Scan flow:**
1. **Pick a photo:** Camera or Photos, with a tip: "Whole timetable in frame, straight on".
2. **Your section/group:** e.g. "Section A, group CSE-2", with chips suggested from the photo when possible.
3. **Reading** (progress). It can take 10–30 s.
4. **Review** the classes found, grouped by course:
   - edit any class
   - remove a course
   - clash warnings with existing courses
   - "N classes, M courses"
5. **Import result.**

**Errors:**
- no key (link to the key screen)
- key rejected
- daily limit reached
- photo unreadable (try again tips)
- no internet

**Key screen:**
- What the key is and that it stays on this phone.
- A paste field (hidden text).
- "Get a free key at aistudio.google.com" with steps.
- Test-and-save button with its result states.

## Every screen
- Show the empty, loading, error and long-text states, plus a 360 dp wide version.
- Touch targets of at least 44 dp.
- No placeholder numbers presented as real data.
- Hand-off notes: list each state and what triggers it, like the schedule-changes hand-off.
