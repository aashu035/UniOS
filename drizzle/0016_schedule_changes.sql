CREATE TABLE `day_rules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`kind` text NOT NULL,
	`follows_weekday` integer,
	`borrowed_date` text,
	`borrowed_mode` text,
	`linked_rule_id` integer,
	`reason` text,
	`note` text,
	`source` text DEFAULT 'you',
	`created_at` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `day_rules_date_idx` ON `day_rules` (`date`);
--> statement-breakpoint
ALTER TABLE `schedule_exceptions` ADD `target_date` text;
--> statement-breakpoint
ALTER TABLE `schedule_exceptions` ADD `reason` text;
--> statement-breakpoint
ALTER TABLE `schedule_exceptions` ADD `created_at` text;
--> statement-breakpoint
CREATE INDEX `idx_exception_target_date` ON `schedule_exceptions` (`target_date`);
