import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { workspaces } from '../workspace/model';

export const resources = sqliteTable('resources', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  workspaceId: integer('workspace_id').references(() => workspaces.id),
  title: text('title').notNull(),
  type: text('type').default('document'), // pdf/video/link/note
  uri: text('uri').notNull(), // file path or URL
  isOffline: integer('is_offline', { mode: 'boolean' }).default(false),
  sizeBytes: integer('size_bytes'),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
});
