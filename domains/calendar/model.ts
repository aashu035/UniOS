import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { workspaces, courseComponents } from '../workspace/model';
import { venues } from '../venue/model';
import { faculty } from '../faculty/model';

// Replaces 'timetable' for legacy events or generic events.
export const calendarEvents = sqliteTable('calendar_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  workspaceId: integer('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
  title: text('title'), // For external work or custom events
  description: text('description'),
  dayOfWeek: integer('day_of_week'), // 0=Sun, 1=Mon... for recurring classes
  specificDate: text('specific_date'), // For non-recurring events
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  type: text('type').default('lecture'), // lecture/lab/exam/holiday/work
  venueOverrideId: integer('venue_override_id').references(() => venues.id),
  location: text('location'), // User-defined raw string fallback
  recurrenceGroupId: text('recurrence_group_id'),
  endDate: text('end_date'),
}, (table) => ({
  dateIdx: index('idx_calendar_date').on(table.specificDate),
}));

export const recurringSchedules = sqliteTable('recurring_schedules', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  componentId: integer('component_id').notNull().references(() => courseComponents.id, { onDelete: 'cascade' }),
  dayOfWeek: integer('day_of_week').notNull(), // 0=Sun, 1=Mon...
  startTime: text('start_time').notNull(), // 'HH:MM'
  endTime: text('end_time').notNull(), // 'HH:MM' - rigidly matches component duration
  venueOverrideId: integer('venue_override_id').references(() => venues.id), // Nullable
  effectiveStartDate: text('effective_start_date'), // ISO date. Null = from the beginning of time
  effectiveEndDate: text('effective_end_date'), // ISO date. Null = indefinitely into future
});

export const scheduleExceptions = sqliteTable('schedule_exceptions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  componentId: integer('component_id').notNull().references(() => courseComponents.id, { onDelete: 'cascade' }),
  recurringScheduleId: integer('recurring_schedule_id').references(() => recurringSchedules.id, { onDelete: 'cascade' }), // Null for 'extra'
  specificDate: text('specific_date').notNull(), // ISO date
  action: text('action').notNull(), // 'move', 'cancel', 'replace', 'extra'
  startTime: text('start_time'), // 'HH:MM' (Required for move/replace/extra)
  endTime: text('end_time'), // 'HH:MM' (Required for move/replace/extra)
  venueOverrideId: integer('venue_override_id').references(() => venues.id), // Optional
  facultyOverrideId: integer('faculty_override_id').references(() => faculty.id), // Optional
  targetDate: text('target_date'), // move only: the date it moves to (null = same day)
  reason: text('reason'), // why: "Teacher absent", "Syllabus catch-up", …
  createdAt: text('created_at'),
}, (table) => ({
  exceptionDateIdx: index('idx_exception_date').on(table.specificDate),
  exceptionTargetIdx: index('idx_exception_target_date').on(table.targetDate),
}));

/**
 * Whole-day changes. `follow`: the date runs another weekday's timetable
 * (Thu 8 Oct follows Friday). `off`: no classes that day (holiday, fest, or the
 * borrowed day of a follow, linked by `linkedRuleId`). One rule per date.
 */
export const dayRules = sqliteTable('day_rules', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  date: text('date').notNull(),
  kind: text('kind').notNull(), // 'follow' | 'off'
  followsWeekday: integer('follows_weekday'), // 0=Sun … 6=Sat, for 'follow'
  borrowedDate: text('borrowed_date'), // follow: the date whose timetable was borrowed (if it is a real upcoming date)
  borrowedMode: text('borrowed_mode'), // follow: 'holiday' | 'normal' | 'unsure'
  linkedRuleId: integer('linked_rule_id'), // off: the follow rule that made this day a holiday
  reason: text('reason'),
  note: text('note'),
  source: text('source').default('you'),
  createdAt: text('created_at'),
});

