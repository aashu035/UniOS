import { sqliteTable, text, integer, real, unique } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { workspaces, courseComponents } from '../workspace/model';

// Local attendance is strictly component-level (Theory vs Lab tracking)
export const attendance = sqliteTable('attendance', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  componentId: integer('component_id').notNull().references(() => courseComponents.id, { onDelete: 'cascade' }),
  date: text('date').notNull(), // Specific date of the lecture
  source: text('source').default('local'), // Explicitly marking source
  status: text('status').notNull(), // present/absent/cancelled/holiday
  markedAt: text('marked_at').default(sql`(CURRENT_TIMESTAMP)`),
  notes: text('notes'),
}, (table) => {
  return {
    componentDateUnique: unique('component_date_idx').on(table.componentId, table.date)
  };
});

// Portal attendance is an aggregate snapshot, usually at the Course level, but optionally at Component level
export const portalAttendance = sqliteTable('portal_attendance', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  workspaceId: integer('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  componentId: integer('component_id').references(() => courseComponents.id, { onDelete: 'cascade' }), // Nullable, only if portal provides component breakdown
  portalTotal: integer('portal_total'),
  portalPresent: integer('portal_present'),
  portalPercent: real('portal_percent'),
  checkedDate: text('checked_date').notNull(),
  screenshotUri: text('screenshot_uri'),
});
