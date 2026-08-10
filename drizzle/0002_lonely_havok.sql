-- This baseline migration is intentionally retained because the journal marks it
-- as applied before 0003. Migration 0003 repairs the resource key type and adds
-- the foreign keys introduced in the final schema.
CREATE TABLE `ai_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`base_url` text NOT NULL,
	`device_fingerprint` text,
	`pairing_state` text DEFAULT 'pending' NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP),
	`last_verified_at` text,
	`revoked_at` text
);
--> statement-breakpoint
CREATE TABLE `learning_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` integer,
	`preferred_language` text DEFAULT 'English',
	`explanation_depth` text DEFAULT 'balanced',
	`example_style` text DEFAULT 'general',
	`pace` text DEFAULT 'normal',
	`accessibility_notes` text,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE TABLE `material_index_permissions` (
	`id` text PRIMARY KEY NOT NULL,
	`resource_id` text NOT NULL,
	`connection_id` text NOT NULL,
	`status` text DEFAULT 'approved' NOT NULL,
	`content_hash` text,
	`approved_at` text DEFAULT (CURRENT_TIMESTAMP),
	`revoked_at` text
);
--> statement-breakpoint
CREATE TABLE `tutor_conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`connection_id` text NOT NULL,
	`title` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP),
	`deleted_at` text
);
--> statement-breakpoint
CREATE TABLE `tutor_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`role` text NOT NULL,
	`body` text NOT NULL,
	`source_manifest` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP),
	`deleted_at` text
);
