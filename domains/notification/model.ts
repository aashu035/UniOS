import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const notifications = sqliteTable('notifications', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').default('info'), // alert/info/success
  isRead: integer('is_read', { mode: 'boolean' }).default(false),
  actionUrl: text('action_url'), // Deep link route
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
});
