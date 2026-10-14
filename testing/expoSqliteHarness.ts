import Database from 'better-sqlite3';
import path from 'path';
import { drizzle as drizzleBetter } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { drizzle as drizzleExpo } from 'drizzle-orm/expo-sqlite';
import * as schema from '../core/db/schema';

/**
 * A database that behaves like the phone's.
 *
 * Most DB tests run drizzle's better-sqlite3 driver and replace `db.transaction`
 * with `cb => cb(db)`, so they can never see a transaction that fails to roll
 * back. Here the app talks to drizzle's real expo-sqlite driver (the code path
 * used on the device), backed by an in-memory SQLite that speaks the slice of
 * the expo-sqlite API that driver calls. BEGIN/COMMIT/ROLLBACK are real.
 */
export function createDeviceDb() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = OFF');
  migrate(drizzleBetter(sqlite, { schema }), { migrationsFolder: path.join(__dirname, '../drizzle') });
  sqlite.pragma('foreign_keys = ON');

  const result = (st: Database.Statement, params: unknown[]) => {
    if (st.reader) {
      const rows = st.all(...params);
      return { changes: 0, lastInsertRowId: 0, getAllSync: () => rows, getFirstSync: () => rows[0] ?? null };
    }
    const r = st.run(...params);
    return { changes: r.changes, lastInsertRowId: Number(r.lastInsertRowid), getAllSync: () => [], getFirstSync: () => null };
  };

  const client = {
    prepareSync(sql: string) {
      return {
        executeSync: (params: unknown[] = []) => result(sqlite.prepare(sql), params),
        executeForRawResultSync: (params: unknown[] = []) => {
          const st = sqlite.prepare(sql);
          const rows = st.reader ? st.raw(true).all(...params) : (st.run(...params), []);
          return { getAllSync: () => rows };
        },
        finalizeSync() {},
      };
    },
    execSync: (sql: string) => sqlite.exec(sql),
    getFirstSync: (sql: string) => sqlite.prepare(sql).get(),
    getFirstAsync: async (sql: string) => sqlite.prepare(sql).get(),
    getAllAsync: async (sql: string, ...params: unknown[]) => sqlite.prepare(sql).all(...params),
  };

  const db = drizzleExpo(client as any, { schema });
  return { sqlite, db, expoDb: client };
}

/** Row counts per table, for asserting that a failed operation left nothing behind. */
export function counts(sqlite: Database.Database, tables: string[]) {
  return Object.fromEntries(tables.map((t) => [t, (sqlite.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n]));
}
