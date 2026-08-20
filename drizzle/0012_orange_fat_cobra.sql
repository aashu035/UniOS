DROP INDEX IF EXISTS `component_date_idx`;--> statement-breakpoint
ALTER TABLE `attendance` ADD `occurrence_id` text;--> statement-breakpoint
ALTER TABLE `attendance` ADD `identity_status` text DEFAULT 'unresolved_legacy' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `occurrence_idx` ON `attendance` (`occurrence_id`);--> statement-breakpoint
UPDATE `attendance` SET `occurrence_id` = NULL WHERE `occurrence_id` = '';