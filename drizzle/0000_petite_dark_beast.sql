CREATE TABLE `students` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`enrollment_no` text,
	`university` text DEFAULT 'DCRUST Murthal',
	`branch` text,
	`current_semester` integer DEFAULT 1,
	`target_cgpa` real DEFAULT 8,
	`hero_portrait_uri` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE TABLE `dcrust_grading` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`grade_letter` text NOT NULL,
	`grade_point` real NOT NULL,
	`min_marks` integer,
	`max_marks` integer,
	`description` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dcrust_grading_grade_letter_unique` ON `dcrust_grading` (`grade_letter`);--> statement-breakpoint
CREATE TABLE `semesters` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`number` integer NOT NULL,
	`name` text,
	`type` text DEFAULT 'odd',
	`start_date` text,
	`end_date` text,
	`is_active` integer DEFAULT false,
	`sgpa` real
);
--> statement-breakpoint
CREATE TABLE `venues` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`building` text,
	`floor` text,
	`map_link` text
);
--> statement-breakpoint
CREATE TABLE `faculty` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`email` text,
	`phone` text,
	`department` text,
	`cabin` text,
	`office_hours` text,
	`photo_uri` text,
	`notes` text
);
--> statement-breakpoint
CREATE TABLE `workspace_timeline` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`workspace_id` integer,
	`event_type` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`timestamp` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`semester_id` integer,
	`name` text NOT NULL,
	`short_name` text,
	`code` text,
	`credits` integer DEFAULT 3,
	`type` text DEFAULT 'theory',
	`faculty_id` integer,
	`venue_id` integer,
	`color` text DEFAULT '#6C5CE7',
	`target_attendance` real DEFAULT 75,
	`notes` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`semester_id`) REFERENCES `semesters`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`faculty_id`) REFERENCES `faculty`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`venue_id`) REFERENCES `venues`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `attendance` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`workspace_id` integer,
	`date` text NOT NULL,
	`status` text NOT NULL,
	`marked_at` text DEFAULT (CURRENT_TIMESTAMP),
	`notes` text,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `portal_attendance` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`workspace_id` integer,
	`portal_total` integer,
	`portal_present` integer,
	`portal_percent` real,
	`checked_date` text NOT NULL,
	`screenshot_uri` text,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`workspace_id` integer,
	`title` text NOT NULL,
	`description` text,
	`type` text DEFAULT 'assignment',
	`due_date` text,
	`priority` text DEFAULT 'medium',
	`status` text DEFAULT 'pending',
	`marks_obtained` real,
	`marks_total` real,
	`feedback` text,
	`file_uris` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `calendar_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`workspace_id` integer,
	`day_of_week` integer,
	`specific_date` text,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`type` text DEFAULT 'lecture',
	`venue_override_id` integer,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`venue_override_id`) REFERENCES `venues`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`type` text DEFAULT 'info',
	`is_read` integer DEFAULT false,
	`action_url` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE TABLE `resources` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`workspace_id` integer,
	`title` text NOT NULL,
	`type` text DEFAULT 'document',
	`uri` text NOT NULL,
	`is_offline` integer DEFAULT false,
	`size_bytes` integer,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
