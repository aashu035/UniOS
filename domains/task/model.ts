import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { workspaces } from '../workspace/model';

export const tasks = sqliteTable('tasks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  workspaceId: integer('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  type: text('type').default('assignment'), // assignment/quiz/lab/exam/todo
  dueDate: text('due_date'),
  priority: text('priority').default('medium'),
  status: text('status').default('pending'), // pending/submitted/graded/overdue
  marksObtained: real('marks_obtained'),
  marksTotal: real('marks_total'),
  feedback: text('feedback'),
  fileUris: text('file_uris'), // JSON array of attached files
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
});
