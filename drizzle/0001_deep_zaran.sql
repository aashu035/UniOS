PRAGMA foreign_keys=OFF;--> statement-breakpoint
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
	`created_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_resources`("id", "workspace_id", "title", "type", "uri", "text_content", "thumbnail_url", "is_offline", "size_bytes", "created_at") SELECT "id", "workspace_id", "title", "type", "uri", NULL, NULL, "is_offline", "size_bytes", "created_at" FROM `resources`;--> statement-breakpoint
DROP TABLE `resources`;--> statement-breakpoint
ALTER TABLE `__new_resources` RENAME TO `resources`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `calendar_events` ADD `title` text;--> statement-breakpoint
ALTER TABLE `calendar_events` ADD `description` text;