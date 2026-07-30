import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { workspaces } from '../workspace/model';
import { venues } from '../venue/model';

// Replaces 'timetable'
export const calendarEvents = sqliteTable('calendar_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  workspaceId: integer('workspace_id').references(() => workspaces.id),
  dayOfWeek: integer('day_of_week'), // 0=Sun, 1=Mon... for recurring classes
  specificDate: text('specific_date'), // For non-recurring events
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  type: text('type').default('lecture'), // lecture/lab/exam/holiday
  venueOverrideId: integer('venue_override_id').references(() => venues.id),
});
