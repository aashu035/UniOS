PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_attendance` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`component_id` integer NOT NULL,
	`occurrence_id` text NOT NULL,
	`identity_status` text DEFAULT 'unresolved_legacy' NOT NULL,
	`date` text NOT NULL,
	`source` text DEFAULT 'local',
	`status` text NOT NULL,
	`marked_at` text DEFAULT (CURRENT_TIMESTAMP),
	`notes` text,
	FOREIGN KEY (`component_id`) REFERENCES `course_components`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_attendance`("id", "component_id", "occurrence_id", "identity_status", "date", "source", "status", "marked_at", "notes") SELECT "id", "component_id", "occurrence_id", "identity_status", "date", "source", "status", "marked_at", "notes" FROM `attendance`;--> statement-breakpoint
DROP TABLE `attendance`;--> statement-breakpoint
ALTER TABLE `__new_attendance` RENAME TO `attendance`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `occurrence_idx` ON `attendance` (`occurrence_id`);--> statement-breakpoint
CREATE TABLE `__new_tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`workspace_id` integer,
	`title` text NOT NULL,
	`description` text,
	`type` text DEFAULT 'assignment',
	`due_date` text,
	`priority` text DEFAULT 'medium' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
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
ALTER TABLE `__new_tasks` RENAME TO `tasks`;