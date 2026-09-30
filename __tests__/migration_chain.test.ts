import Database from 'better-sqlite3';
import path from 'path';
// @ts-ignore
import { drizzle } from 'drizzle-orm/better-sqlite3';
// @ts-ignore
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

// Runs the real drizzle/ migration chain end-to-end, the way core/db/coordinator.ts
// does on device (foreign keys off during migration). Catches multi-statement chunks
// missing a `--> statement-breakpoint`, broken journal tags, and schema drift.
describe('Drizzle migration chain', () => {
  it('applies every migration on a fresh database', () => {
    const sqlite = new Database(':memory:');
    sqlite.pragma('foreign_keys = OFF');
    migrate(drizzle(sqlite), { migrationsFolder: path.join(__dirname, '../drizzle') });
    sqlite.pragma('foreign_keys = ON');

    const cols = sqlite.prepare(`SELECT name, "notnull" FROM pragma_table_info('attendance')`).all() as { name: string; notnull: number }[];
    expect(cols.find(c => c.name === 'occurrence_id')?.notnull).toBe(1);
    expect(cols.find(c => c.name === 'component_id')?.notnull).toBe(1);
    expect(sqlite.prepare('SELECT COUNT(*) AS c FROM pragma_foreign_key_check').get()).toEqual({ c: 0 });
  });
});
