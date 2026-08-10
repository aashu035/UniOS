PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_material_index_permissions` (
	`id` text PRIMARY KEY NOT NULL,
	`resource_id` integer NOT NULL,
	`connection_id` text NOT NULL,
	`status` text DEFAULT 'approved' NOT NULL,
	`content_hash` text,
	`approved_at` text DEFAULT (CURRENT_TIMESTAMP),
	`revoked_at` text,
	FOREIGN KEY (`resource_id`) REFERENCES `resources`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`connection_id`) REFERENCES `ai_connections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_material_index_permissions`("id", "resource_id", "connection_id", "status", "content_hash", "approved_at", "revoked_at") SELECT "id", "resource_id", "connection_id", "status", "content_hash", "approved_at", "revoked_at" FROM `material_index_permissions`;--> statement-breakpoint
DROP TABLE `material_index_permissions`;--> statement-breakpoint
ALTER TABLE `__new_material_index_permissions` RENAME TO `material_index_permissions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `ai_connections` ADD `token` text;--> statement-breakpoint
CREATE TABLE `__new_tutor_conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`connection_id` text NOT NULL,
	`title` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP),
	`deleted_at` text,
	FOREIGN KEY (`connection_id`) REFERENCES `ai_connections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_tutor_conversations`("id", "connection_id", "title", "created_at", "deleted_at") SELECT "id", "connection_id", "title", "created_at", "deleted_at" FROM `tutor_conversations`;--> statement-breakpoint
DROP TABLE `tutor_conversations`;--> statement-breakpoint
ALTER TABLE `__new_tutor_conversations` RENAME TO `tutor_conversations`;--> statement-breakpoint
CREATE TABLE `__new_tutor_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`role` text NOT NULL,
	`body` text NOT NULL,
	`source_manifest` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP),
	`deleted_at` text,
	FOREIGN KEY (`conversation_id`) REFERENCES `tutor_conversations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_tutor_messages`("id", "conversation_id", "role", "body", "source_manifest", "created_at", "deleted_at") SELECT "id", "conversation_id", "role", "body", "source_manifest", "created_at", "deleted_at" FROM `tutor_messages`;--> statement-breakpoint
DROP TABLE `tutor_messages`;--> statement-breakpoint
ALTER TABLE `__new_tutor_messages` RENAME TO `tutor_messages`;--> statement-breakpoint
ALTER TABLE `learning_profiles` DROP COLUMN `student_id`;
