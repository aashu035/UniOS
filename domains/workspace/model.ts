import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { semesters } from '../semester/model';
import { faculty } from '../faculty/model';
import { venues } from '../venue/model';

// Internally called 'workspaces', externally known as 'Subjects' or 'Courses'
export const workspaces = sqliteTable('workspaces', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  semesterId: integer('semester_id').references(() => semesters.id),
  name: text('name').notNull(),
  shortName: text('short_name'),
  code: text('code'),
  credits: integer('credits').default(3),
  defaultFacultyId: integer('default_faculty_id').references(() => faculty.id),
  color: text('color').default('#6C5CE7'),
  icon: text('icon').default('book'),
  targetAttendance: real('target_attendance').default(75.0),
  notes: text('notes'),
  needsReview: integer('needs_review', { mode: 'boolean' }).default(false), // Flag for ambiguous migrations
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
});

export const courseComponents = sqliteTable('course_components', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  workspaceId: integer('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // 'theory' | 'lab' | 'tutorial'
  facultyId: integer('faculty_id').references(() => faculty.id), // Nullable for inheritance
  durationMinutes: integer('duration_minutes').notNull(), // 60 or 120
  assessmentAllocation: integer('assessment_allocation'), // e.g. 50
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
});

export const componentVenueAssignments = sqliteTable('component_venue_assignments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  componentId: integer('component_id').notNull().references(() => courseComponents.id, { onDelete: 'cascade' }),
  venueId: integer('venue_id').notNull().references(() => venues.id),
  effectiveFrom: text('effective_from').notNull(), // ISO date
  effectiveUntil: text('effective_until'), // ISO date (nullable if active)
});

export const componentFacultyAssignments = sqliteTable('component_faculty_assignments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  componentId: integer('component_id').notNull().references(() => courseComponents.id, { onDelete: 'cascade' }),
  facultyId: integer('faculty_id').notNull().references(() => faculty.id),
  effectiveFrom: text('effective_from').notNull(), // ISO date
  effectiveUntil: text('effective_until'), // ISO date (nullable if active)
});

// Subject Timeline events (Git-style history)
export const workspaceTimeline = sqliteTable('workspace_timeline', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  workspaceId: integer('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
  eventType: text('event_type').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  timestamp: text('timestamp').default(sql`(CURRENT_TIMESTAMP)`),
});

