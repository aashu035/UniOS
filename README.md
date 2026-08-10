# UniOS

UniOS is a comprehensive, privacy-first, offline academic organizer designed for students. It acts as a personal academic hub to track semesters, courses, schedules, tasks, and study materials natively on your device.

## Key Features (In-Progress & Planned)
- **Offline First**: All data is stored locally via SQLite.
- **Academic Management (In-Progress)**: Organize semesters, workspaces (courses), venues, and faculty with full CRUD capabilities.
- **Planner & Timetable (In-Progress)**: Track recurring classes with weekday schedule grouping and assignments.
- **Resource Hub (In-Progress)**: Attach, organize, and manage study materials lifecycle.
- **Privacy Focused AI (Proposed)**: No cloud syncing, no data sharing. Future integrations will feature a local, private AI companion running natively on a paired laptop.

## Getting Started

### Prerequisites
- Node.js (Current LTS recommended)
- Android Studio (for Android Emulator) or iOS Simulator

### Installation
1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npx expo start
   ```

3. To build and run natively on Android:
   ```bash
   npx expo run:android
   ```

## Documentation
For deeper dives into the project's structure, requirements, and architecture, refer to the documentation set:

- **[Product Requirements (PRD)](docs/product/PRD.md)**: Product vision, user journeys, and scope.
- **[Software Requirements (SRS)](docs/requirements/SRS.md)**: Detailed functional and non-functional requirements.
- **[Tech Stack](docs/architecture/TECH_STACK.md)**: Libraries and runtimes utilized.
- **[Architecture](docs/architecture/ARCHITECTURE.md)**: Component boundaries and data flow.
- **[Entity Relationship Diagram (ERD)](docs/architecture/ERD.md)**: Database schema and relationships.
- **[Source of Truth](docs/SOURCE_OF_TRUTH.md)**: Documentation precedence and change control.
