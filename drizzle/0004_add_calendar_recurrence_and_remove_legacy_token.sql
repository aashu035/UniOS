ALTER TABLE `calendar_events` ADD `recurrence_group_id` text;--> statement-breakpoint
ALTER TABLE `calendar_events` ADD `end_date` text;--> statement-breakpoint
ALTER TABLE `ai_connections` DROP COLUMN `token`;