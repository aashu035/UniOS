import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { resources } from '../resource/model';

export const aiConnections = sqliteTable('ai_connections', {
  id: text('id').primaryKey(),
  label: text('label').notNull(),
  baseUrl: text('base_url').notNull(),
  deviceFingerprint: text('device_fingerprint'),
  pairingState: text('pairing_state').default('pending').notNull(), // pending, paired, revoked
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
  lastVerifiedAt: text('last_verified_at'),
  revokedAt: text('revoked_at'),
});

export const learningProfiles = sqliteTable('learning_profiles', {
  id: text('id').primaryKey(),
  preferredLanguage: text('preferred_language').default('English'),
  explanationDepth: text('explanation_depth').default('balanced'),
  exampleStyle: text('example_style').default('general'),
  pace: text('pace').default('normal'),
  accessibilityNotes: text('accessibility_notes'),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`),
});

export const materialIndexPermissions = sqliteTable('material_index_permissions', {
  id: text('id').primaryKey(),
  resourceId: integer('resource_id').notNull().references(() => resources.id, { onDelete: 'cascade' }),
  connectionId: text('connection_id').notNull().references(() => aiConnections.id, { onDelete: 'cascade' }),
  status: text('status').default('approved').notNull(),
  contentHash: text('content_hash'),
  approvedAt: text('approved_at').default(sql`(CURRENT_TIMESTAMP)`),
  revokedAt: text('revoked_at'),
});

export const tutorConversations = sqliteTable('tutor_conversations', {
  id: text('id').primaryKey(),
  connectionId: text('connection_id').notNull().references(() => aiConnections.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
  deletedAt: text('deleted_at'),
});

export const tutorMessages = sqliteTable('tutor_messages', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id').notNull().references(() => tutorConversations.id, { onDelete: 'cascade' }),
  role: text('role').notNull(), // user or assistant
  body: text('body').notNull(),
  sourceManifest: text('source_manifest'), // JSON string of sources
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
  deletedAt: text('deleted_at'),
});
