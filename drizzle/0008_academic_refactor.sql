-- Migration 0008: Academic Component Refactor
-- Transforms Course -> CalendarEvent into Course -> Component -> RecurringSchedule/Exception
-- This migration is self-contained and handles both new tables AND data migration.
--
-- EXECUTION ORDER:
-- A. Create new empty tables (no FK conflicts since they're new)
-- B. Populate course_components from workspaces (workspaces still has type/faculty_id/venue_id)
-- C. Populate component_venue_assignments from workspaces
-- D. Migrate calendar_events -> recurring_schedules
-- E. Migrate calendar_events -> schedule_exceptions
-- F. Rebuild attendance (workspace_id -> component_id, backfill via JOIN)
-- G. Rebuild portal_attendance (add nullable component_id)
-- H. Rebuild workspaces (drop type/faculty_id/venue_id, add default_faculty_id/needs_review)

PRAGMA foreign_keys=OFF;
--> statement-breakpoint

-- ============================================================
-- A. CREATE NEW TABLES
-- ============================================================

CREATE TABLE `course_components` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`workspace_id` integer NOT NULL,
	`type` text NOT NULL,
	`faculty_id` integer,
	`duration_minutes` integer NOT NULL,
	`assessment_allocation` integer,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`faculty_id`) REFERENCES `faculty`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `component_venue_assignments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`component_id` integer NOT NULL,
	`venue_id` integer NOT NULL,
	`effective_from` text NOT NULL,
	`effective_until` text,
	FOREIGN KEY (`component_id`) REFERENCES `course_components`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`venue_id`) REFERENCES `venues`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `recurring_schedules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`component_id` integer NOT NULL,
	`day_of_week` integer NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`venue_override_id` integer,
	FOREIGN KEY (`component_id`) REFERENCES `course_components`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`venue_override_id`) REFERENCES `venues`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `schedule_exceptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`component_id` integer NOT NULL,
	`recurring_schedule_id` integer,
	`specific_date` text NOT NULL,
	`action` text NOT NULL,
	`start_time` text,
	`end_time` text,
	`venue_override_id` integer,
	`faculty_override_id` integer,
	FOREIGN KEY (`component_id`) REFERENCES `course_components`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recurring_schedule_id`) REFERENCES `recurring_schedules`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`venue_override_id`) REFERENCES `venues`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`faculty_override_id`) REFERENCES `faculty`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_exception_date` ON `schedule_exceptions` (`specific_date`);

-- ============================================================
-- B. POPULATE COURSE_COMPONENTS FROM WORKSPACES
-- At this point workspaces still has: type, faculty_id, venue_id
-- Rule: type IN ('theory','lab','tutorial') -> use as-is
--        type IS NULL or type NOT IN those three -> flag needs_review, default to 'theory'
-- ============================================================
--> statement-breakpoint
INSERT INTO course_components (workspace_id, type, faculty_id, duration_minutes, assessment_allocation)
SELECT
    id,
    CASE
        WHEN type IN ('theory', 'lab', 'tutorial') THEN type
        ELSE 'theory'
    END,
    faculty_id,
    CASE
        WHEN type = 'lab' THEN 120
        ELSE 60
    END,
    100
FROM workspaces;

-- ============================================================
-- C. POPULATE COMPONENT_VENUE_ASSIGNMENTS
-- ============================================================
--> statement-breakpoint
INSERT INTO component_venue_assignments (component_id, venue_id, effective_from)
SELECT c.id, w.venue_id, COALESCE(w.created_at, '2024-01-01T00:00:00.000Z')
FROM workspaces w
INNER JOIN course_components c ON c.workspace_id = w.id
WHERE w.venue_id IS NOT NULL;

-- ============================================================
-- D. MIGRATE RECURRING CALENDAR_EVENTS -> RECURRING_SCHEDULES
-- Only events with day_of_week set (weekly recurrence pattern)
-- ============================================================
--> statement-breakpoint
INSERT INTO recurring_schedules (component_id, day_of_week, start_time, end_time, venue_override_id)
SELECT c.id, e.day_of_week, e.start_time, e.end_time, e.venue_override_id
FROM calendar_events e
INNER JOIN course_components c ON c.workspace_id = e.workspace_id
WHERE e.day_of_week IS NOT NULL;

-- ============================================================
-- E. MIGRATE NON-RECURRING CALENDAR_EVENTS -> SCHEDULE_EXCEPTIONS
-- Events with specific_date but no day_of_week are one-off extras
-- ============================================================
--> statement-breakpoint
INSERT INTO schedule_exceptions (component_id, specific_date, action, start_time, end_time, venue_override_id)
SELECT c.id, e.specific_date, 'extra', e.start_time, e.end_time, e.venue_override_id
FROM calendar_events e
INNER JOIN course_components c ON c.workspace_id = e.workspace_id
WHERE e.specific_date IS NOT NULL AND e.day_of_week IS NULL;

-- ============================================================
-- F. REBUILD ATTENDANCE
-- Old: (id, workspace_id, date, status, marked_at, notes) + unique(workspace_id, date)
-- New: (id, component_id, date, source, status, marked_at, notes) + unique(component_id, date)
-- Backfill: JOIN through course_components to get component_id from workspace_id
-- ============================================================
--> statement-breakpoint
CREATE TABLE `__new_attendance` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`component_id` integer NOT NULL,
	`date` text NOT NULL,
	`source` text DEFAULT 'local',
	`status` text NOT NULL,
	`marked_at` text DEFAULT (CURRENT_TIMESTAMP),
	`notes` text,
	FOREIGN KEY (`component_id`) REFERENCES `course_components`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_attendance`("id", "component_id", "date", "source", "status", "marked_at", "notes")
SELECT a."id", c."id", a."date", 'local', a."status", a."marked_at", a."notes"
FROM attendance a
INNER JOIN course_components c ON c.workspace_id = a.workspace_id;
--> statement-breakpoint
DROP TABLE `attendance`;
--> statement-breakpoint
ALTER TABLE `__new_attendance` RENAME TO `attendance`;
--> statement-breakpoint
CREATE UNIQUE INDEX `component_date_idx` ON `attendance` (`component_id`, `date`);

-- ============================================================
-- G. REBUILD PORTAL_ATTENDANCE
-- Old: (id, workspace_id, portal_total, portal_present, portal_percent, checked_date, screenshot_uri)
-- New: adds component_id (nullable) and makes workspace_id NOT NULL
-- ============================================================
--> statement-breakpoint
CREATE TABLE `__new_portal_attendance` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`workspace_id` integer NOT NULL,
	`component_id` integer,
	`portal_total` integer,
	`portal_present` integer,
	`portal_percent` real,
	`checked_date` text NOT NULL,
	`screenshot_uri` text,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`component_id`) REFERENCES `course_components`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_portal_attendance`("id", "workspace_id", "component_id", "portal_total", "portal_present", "portal_percent", "checked_date", "screenshot_uri")
SELECT "id", "workspace_id", NULL, "portal_total", "portal_present", "portal_percent", "checked_date", "screenshot_uri"
FROM `portal_attendance`;
--> statement-breakpoint
DROP TABLE `portal_attendance`;
--> statement-breakpoint
ALTER TABLE `__new_portal_attendance` RENAME TO `portal_attendance`;

-- ============================================================
-- H. REBUILD WORKSPACES
-- Drop: type, faculty_id, venue_id
-- Add: default_faculty_id, needs_review
-- needs_review rule: flag ALL migrated workspaces (they were single-component,
--   user must decide whether to add the second component)
-- EXCEPT: do NOT flag workspaces whose type was unrecognized (those are already
--   defaulted to 'theory' which is a guess — flag those MORE aggressively)
-- Actually: flag everything. Every legacy workspace needs human review because
--   none of them have the dual-component structure yet.
-- ============================================================
--> statement-breakpoint
CREATE TABLE `__new_workspaces` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`semester_id` integer,
	`name` text NOT NULL,
	`short_name` text,
	`code` text,
	`credits` integer DEFAULT 3,
	`default_faculty_id` integer,
	`color` text DEFAULT '#6C5CE7',
	`target_attendance` real DEFAULT 75.0,
	`notes` text,
	`needs_review` integer DEFAULT 0,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`semester_id`) REFERENCES `semesters`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`default_faculty_id`) REFERENCES `faculty`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_workspaces`("id", "semester_id", "name", "short_name", "code", "credits", "default_faculty_id", "color", "target_attendance", "notes", "needs_review", "created_at")
SELECT "id", "semester_id", "name", "short_name", "code", "credits", "faculty_id", "color", "target_attendance", "notes",
    1,
    "created_at"
FROM `workspaces`;
--> statement-breakpoint
DROP TABLE `workspaces`;
--> statement-breakpoint
ALTER TABLE `__new_workspaces` RENAME TO `workspaces`;

-- ============================================================
-- I. REBUILD CALENDAR_EVENTS
-- Drop: faculty_override_id, batch (added in 0007, now handled at component level)
-- Keep everything else for backwards-compat with any remaining UI code
-- ============================================================
--> statement-breakpoint
CREATE TABLE `__new_calendar_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`workspace_id` integer,
	`title` text,
	`description` text,
	`day_of_week` integer,
	`specific_date` text,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`type` text DEFAULT 'lecture',
	`venue_override_id` integer,
	`location` text,
	`recurrence_group_id` text,
	`end_date` text,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`venue_override_id`) REFERENCES `venues`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_calendar_events`("id", "workspace_id", "title", "description", "day_of_week", "specific_date", "start_time", "end_time", "type", "venue_override_id", "location", "recurrence_group_id", "end_date")
SELECT "id", "workspace_id", "title", "description", "day_of_week", "specific_date", "start_time", "end_time", "type", "venue_override_id", "location", "recurrence_group_id", "end_date"
FROM `calendar_events`;
--> statement-breakpoint
DROP TABLE `calendar_events`;
--> statement-breakpoint
ALTER TABLE `__new_calendar_events` RENAME TO `calendar_events`;
--> statement-breakpoint
CREATE INDEX `idx_calendar_date` ON `calendar_events` (`specific_date`);
--> statement-breakpoint
PRAGMA foreign_keys=ON;