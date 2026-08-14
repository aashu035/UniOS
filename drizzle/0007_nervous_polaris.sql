ALTER TABLE `calendar_events` ADD `faculty_override_id` integer REFERENCES faculty(id);--> statement-breakpoint
ALTER TABLE `calendar_events` ADD `batch` text;