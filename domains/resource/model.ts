import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { workspaces } from '../workspace/model';

export const resources = sqliteTable('resources', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  workspaceId: integer('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  type: text('type').default('document'), // pdf/video/link/note
  uri: text('uri'), // file path or URL (nullable for text-only notes)
  textContent: text('text_content'), // for text-based notes
  thumbnailUrl: text('thumbnail_url'), // for URL previews
  isOffline: integer('is_offline', { mode: 'boolean' }).default(false),
  sizeBytes: integer('size_bytes'),
  fileHash: text('file_hash'),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
});
