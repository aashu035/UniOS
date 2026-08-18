CREATE TABLE `component_faculty_assignments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`component_id` integer NOT NULL,
	`faculty_id` integer NOT NULL,
	`effective_from` text NOT NULL,
	`effective_until` text,
	FOREIGN KEY (`component_id`) REFERENCES `course_components`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`faculty_id`) REFERENCES `faculty`(`id`) ON UPDATE no action ON DELETE no action
);
