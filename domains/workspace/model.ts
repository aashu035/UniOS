import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { semesters } from '../semester/model';
import { faculty } from '../faculty/model';
import { venues } from '../venue/model';

// Internally called 'workspaces', externally known as 'Subjects' for v1
export const workspaces = sqliteTable('workspaces', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  semesterId: integer('semester_id').references(() => semesters.id),
  name: text('name').notNull(),
  shortName: text('short_name'),
  code: text('code'),
  credits: integer('credits').default(3),
  type: text('type').default('theory'), // theory/lab/elective
  facultyId: integer('faculty_id').references(() => faculty.id),
  venueId: integer('venue_id').references(() => venues.id),
  color: text('color').default('#6C5CE7'),
  targetAttendance: real('target_attendance').default(75.0),
  notes: text('notes'),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
});

// Subject Timeline events (Git-style history)
export const workspaceTimeline = sqliteTable('workspace_timeline', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  workspaceId: integer('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
  eventType: text('event_type').notNull(), // e.g. 'assignment_added', 'notes_uploaded', 'attendance_updated'
  title: text('title').notNull(),
  description: text('description'),
  timestamp: text('timestamp').default(sql`(CURRENT_TIMESTAMP)`),
});
