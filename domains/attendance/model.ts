import { sqliteTable, text, integer, real, unique } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { workspaces } from '../workspace/model';

export const attendance = sqliteTable('attendance', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  workspaceId: integer('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
  date: text('date').notNull(),
  status: text('status').notNull(), // present/absent/cancelled/holiday
  markedAt: text('marked_at').default(sql`(CURRENT_TIMESTAMP)`),
  notes: text('notes'),
}, (table) => {
  return {
    workspaceDateUnique: unique('workspace_date_idx').on(table.workspaceId, table.date)
  };
});

export const portalAttendance = sqliteTable('portal_attendance', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  workspaceId: integer('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
  portalTotal: integer('portal_total'),
  portalPresent: integer('portal_present'),
  portalPercent: real('portal_percent'),
  checkedDate: text('checked_date').notNull(),
  screenshotUri: text('screenshot_uri'),
});
