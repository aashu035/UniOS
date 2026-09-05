import Database from 'better-sqlite3';
// @ts-ignore
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../core/db/schema';

// Setup in-memory SQLite with the notifications table only.
// We test the repository in isolation; it doesn't join against any other table.
const sqlite = new Database(':memory:');
sqlite.pragma('foreign_keys = ON');
sqlite.exec(`
  CREATE TABLE notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info',
    is_read INTEGER DEFAULT 0,
    action_url TEXT,
    created_at TEXT DEFAULT (CURRENT_TIMESTAMP)
  );
`);

const testDb: any = drizzle(sqlite, { schema });
// Drizzle expects a transaction method; the better-sqlite3 driver supports
// it natively via .transaction, but we expose it as async for parity with
// the production expo-sqlite client.
testDb.transaction = async (cb: any) => cb(testDb);

// Mock the client module BEFORE the repository imports it. jest hoists jest.mock
// above imports, so this works even though the require is below.
jest.mock('../core/db/client', () => ({
  db: testDb,
  expoDb: {
    execSync: (sql: string) => sqlite.exec(sql),
    getFirstSync: (sql: string) => sqlite.prepare(sql).get(),
    getAllAsync: async (sql: string) => sqlite.prepare(sql).all(),
  },
}));

import { NotificationRepository } from '../domains/notification/repository';

describe('NotificationRepository — CRUD + unread semantics', () => {
  beforeEach(() => {
    sqlite.exec('DELETE FROM notifications;');
  });

  it('creates a notification and returns the row', async () => {
    const row = await NotificationRepository.create({
      title: 'Task overdue',
      message: 'Math assignment is past due.',
      type: 'warning',
      actionUrl: '/(main)/tasks',
    });
    expect(row).toBeTruthy();
    expect(row.title).toBe('Task overdue');
    expect(row.type).toBe('warning');
    expect(row.isRead).toBe(false);
    expect(row.actionUrl).toBe('/(main)/tasks');
  });

  it('defaults type to info and actionUrl to null', async () => {
    const row = await NotificationRepository.create({ title: 't', message: 'm' });
    expect(row.type).toBe('info');
    expect(row.actionUrl).toBeNull();
  });

  it('list returns rows newest first', async () => {
    // Insert with explicit timestamps to avoid SQLite CURRENT_TIMESTAMP's
    // second-level precision (rows in the same second have undefined order).
    sqlite.exec(`INSERT INTO notifications (title, message, type, is_read, action_url, created_at) VALUES
      ('older', 'm', 'info', 0, NULL, '2025-01-01T10:00:00.000Z'),
      ('newer', 'm', 'info', 0, NULL, '2025-01-01T11:00:00.000Z');`);
    const rows = await NotificationRepository.list();
    expect(rows.length).toBe(2);
    expect(rows[0].title).toBe('newer');
    expect(rows[1].title).toBe('older');
  });

  it('countUnread returns 0 when no rows, otherwise unread count', async () => {
    expect(await NotificationRepository.countUnread()).toBe(0);
    await NotificationRepository.create({ title: 'a', message: 'm' });
    await NotificationRepository.create({ title: 'b', message: 'm' });
    expect(await NotificationRepository.countUnread()).toBe(2);
  });

  it('markRead sets isRead=true and decreases countUnread', async () => {
    const a = await NotificationRepository.create({ title: 'a', message: 'm' });
    const b = await NotificationRepository.create({ title: 'b', message: 'm' });
    expect(await NotificationRepository.countUnread()).toBe(2);
    await NotificationRepository.markRead(a.id);
    expect(await NotificationRepository.countUnread()).toBe(1);
    // marking the same row again is a no-op
    await NotificationRepository.markRead(a.id);
    expect(await NotificationRepository.countUnread()).toBe(1);
  });

  it('markAllRead flips every unread row', async () => {
    await NotificationRepository.create({ title: 'a', message: 'm' });
    await NotificationRepository.create({ title: 'b', message: 'm' });
    await NotificationRepository.create({ title: 'c', message: 'm' });
    await NotificationRepository.markAllRead();
    expect(await NotificationRepository.countUnread()).toBe(0);
    // All rows still exist (markAllRead doesn't delete)
    const rows = await NotificationRepository.list();
    expect(rows.length).toBe(3);
  });

  it('listUnread returns only unread rows in newest-first order', async () => {
    // Same second-level precision issue as the previous test; use explicit timestamps.
    sqlite.exec(`INSERT INTO notifications (id, title, message, type, is_read, action_url, created_at) VALUES
      (1, 'a', 'm', 'info', 0, NULL, '2025-01-01T10:00:00.000Z'),
      (2, 'b', 'm', 'info', 0, NULL, '2025-01-01T11:00:00.000Z'),
      (3, 'c', 'm', 'info', 0, NULL, '2025-01-01T12:00:00.000Z');`);
    await NotificationRepository.markRead(2);
    const unread = await NotificationRepository.listUnread();
    expect(unread.map((r: any) => r.id)).toEqual([3, 1]);
  });
});
