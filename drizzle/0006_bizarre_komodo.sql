PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_workspace_timeline` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`workspace_id` integer,
	`event_type` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`timestamp` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_workspace_timeline`("id", "workspace_id", "event_type", "title", "description", "timestamp") SELECT "id", "workspace_id", "event_type", "title", "description", "timestamp" FROM `workspace_timeline`;--> statement-breakpoint
DROP TABLE `workspace_timeline`;--> statement-breakpoint
ALTER TABLE `__new_workspace_timeline` RENAME TO `workspace_timeline`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_attendance` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`workspace_id` integer,
	`date` text NOT NULL,
	`status` text NOT NULL,
	`marked_at` text DEFAULT (CURRENT_TIMESTAMP),
	`notes` text,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_attendance`("id", "workspace_id", "date", "status", "marked_at", "notes") SELECT "id", "workspace_id", "date", "status", "marked_at", "notes" FROM `attendance`;--> statement-breakpoint
DROP TABLE `attendance`;--> statement-breakpoint
ALTER TABLE `__new_attendance` RENAME TO `attendance`;--> statement-breakpoint
CREATE TABLE `__new_portal_attendance` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`workspace_id` integer,
	`portal_total` integer,
	`portal_present` integer,
	`portal_percent` real,
	`checked_date` text NOT NULL,
	`screenshot_uri` text,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_portal_attendance`("id", "workspace_id", "portal_total", "portal_present", "portal_percent", "checked_date", "screenshot_uri") SELECT "id", "workspace_id", "portal_total", "portal_present", "portal_percent", "checked_date", "screenshot_uri" FROM `portal_attendance`;--> statement-breakpoint
DROP TABLE `portal_attendance`;--> statement-breakpoint
ALTER TABLE `__new_portal_attendance` RENAME TO `portal_attendance`;--> statement-breakpoint
CREATE TABLE `__new_tasks` (
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
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_tasks`("id", "workspace_id", "title", "description", "type", "due_date", "priority", "status", "marks_obtained", "marks_total", "feedback", "file_uris", "created_at") SELECT "id", "workspace_id", "title", "description", "type", "due_date", "priority", "status", "marks_obtained", "marks_total", "feedback", "file_uris", "created_at" FROM `tasks`;--> statement-breakpoint
DROP TABLE `tasks`;--> statement-breakpoint
ALTER TABLE `__new_tasks` RENAME TO `tasks`;--> statement-breakpoint
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
INSERT INTO `__new_calendar_events`("id", "workspace_id", "title", "description", "day_of_week", "specific_date", "start_time", "end_time", "type", "venue_override_id", "location", "recurrence_group_id", "end_date") SELECT "id", "workspace_id", "title", "description", "day_of_week", "specific_date", "start_time", "end_time", "type", "venue_override_id", "location", "recurrence_group_id", "end_date" FROM `calendar_events`;--> statement-breakpoint
DROP TABLE `calendar_events`;--> statement-breakpoint
ALTER TABLE `__new_calendar_events` RENAME TO `calendar_events`;--> statement-breakpoint
CREATE INDEX `idx_calendar_date` ON `calendar_events` (`specific_date`);--> statement-breakpoint
CREATE TABLE `__new_resources` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`workspace_id` integer,
	`title` text NOT NULL,
	`type` text DEFAULT 'document',
	`uri` text,
	`text_content` text,
	`thumbnail_url` text,
	`is_offline` integer DEFAULT false,
	`size_bytes` integer,
	`file_hash` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_resources`("id", "workspace_id", "title", "type", "uri", "text_content", "thumbnail_url", "is_offline", "size_bytes", "file_hash", "created_at") SELECT "id", "workspace_id", "title", "type", "uri", "text_content", "thumbnail_url", "is_offline", "size_bytes", "file_hash", "created_at" FROM `resources`;--> statement-breakpoint
DROP TABLE `resources`;--> statement-breakpoint
ALTER TABLE `__new_resources` RENAME TO `resources`;