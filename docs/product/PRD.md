# Product Requirements Document (PRD) - UniOS

## 1. Product Vision
UniOS is a comprehensive, private, offline-first academic organizer designed to help students manage their semesters, schedules, tasks, and study materials. It serves as a personal academic hub that respects user privacy by storing all data locally. A future addition will integrate a private local AI tutor running on the user's laptop, ensuring that study materials and interactions never leave the local network.

## 2. Target Users
- **University Students**: Needing an organized way to track classes, assignments, and study materials across different semesters.
- **Privacy-Conscious Individuals**: Users who want the benefits of an AI companion and academic organizer without trusting their data to cloud servers.

## 3. Key User Journeys
1. **Semester Management**: Users can create semesters, define their duration, and link workspaces (courses) to them.
2. **Workspace (Course) Management**: Inside a semester, users can create workspaces representing courses, complete with faculty info, venues, and credits.
3. **Weekly Timetable (Planner)**: Users can add recurring weekly classes for their courses. The planner clearly displays what classes are happening on any given day.
4. **Task Tracking**: Users can create, track, and complete tasks (assignments, exams) linked to specific workspaces.
5. **Study Materials Management**: Users can attach notes, PDFs, or links to their workspaces, keeping all resources organized contextually.
6. **Local AI Tutor (Future)**: The user pairs their mobile app with their laptop running a local LLM, allowing them to chat with an AI tutor that has context on their uploaded materials and schedule.

## 4. Priorities & Release Scope
### Phase 1: Core Academic CRUD (Current)
- Complete offline data storage using SQLite.
- Semester and Workspace creation, editing, and deletion (with proper cascading cleanup).
- Recurring class schedules (Planner) with weekly weekday toggles.
- Material/Resource organization and attachment to courses.
- Removal of any hardcoded "demo" data from fresh installs.

### Phase 2: Local AI Integration
- Peer-to-peer pairing between mobile app and laptop via LAN/USB.
- Local LLM server running on the laptop.
- AI Tutor chat interface on the mobile app.
- Permission-based context injection (letting the AI read specific course materials).

## 5. Non-Goals
- **Cloud Syncing**: No user data will be sent to external servers for synchronization.
- **Social Features**: No sharing of schedules, tasks, or materials with other users.
- **Cloud AI APIs**: No integration with OpenAI, Anthropic, or any other cloud-based LLM provider for the core tutor feature.

## 6. Success Measures
- **Reliability**: The app must function entirely without an internet connection (excluding the local LAN connection to the laptop tutor).
- **Performance**: Instantaneous load times for daily planner and tasks.
- **Privacy Assurance**: Zero outgoing network requests to third-party tracking or AI services.
