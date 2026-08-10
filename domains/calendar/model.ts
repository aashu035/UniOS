import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { workspaces } from '../workspace/model';
import { venues } from '../venue/model';

// Replaces 'timetable'
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
