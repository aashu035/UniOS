/**
 * A shared backup is untrusted. Restoring a randomly corrupted backup either
 * succeeds with consistent data, or leaves every table exactly as it was.
 * Device driver, so the restore's transaction is real.
 */
import fc from 'fast-check';
import { createDeviceDb } from '../testing/expoSqliteHarness';

const mockDevice: { db?: any; expoDb?: any } = {};
jest.mock('../core/db/client', () => ({
  get db() { return mockDevice.db; },
  get expoDb() { return mockDevice.expoDb; },
}));

const { exportBackup, importBackup } = require('../core/db/backup');
const { CalendarService } = require('../domains/calendar/service');
const { setOccurrenceStatus } = require('../domains/academic/actions');

const THU = '2026-10-29';
const TABLES = ['students', 'semesters', 'workspaces', 'course_components', 'recurring_schedules', 'tasks', 'attendance', 'day_rules', 'schedule_exceptions'];

it('a corrupted backup either restores or leaves every table exactly as it was', async () => {
  const h = createDeviceDb();
  mockDevice.db = h.db; mockDevice.expoDb = h.expoDb;
  const sqlite = h.sqlite;
  sqlite.exec(`
    INSERT INTO students (id, name, branch, current_semester) VALUES (1, 'Test Student', 'CSE', 5);
    INSERT INTO semesters (id, number, name, start_date, is_active) VALUES (1, 5, 'Sem 5', '2026-07-01', 1);
    INSERT INTO workspaces (id, semester_id, name, color, target_attendance) VALUES (1, 1, 'OS', '#000', 75), (2, 1, 'CN', '#000', 75);
    INSERT INTO course_components (id, workspace_id, type, duration_minutes) VALUES (1, 1, 'theory', 60), (2, 2, 'theory', 60);
    INSERT INTO recurring_schedules (id, component_id, day_of_week, start_time, end_time) VALUES (1, 1, 4, '09:00', '10:00'), (2, 2, 5, '10:00', '11:00');
    INSERT INTO tasks (id, workspace_id, title, type, due_date, priority, status) VALUES (1, 1, 'OS assignment', 'assignment', '2026-11-02', 'high', 'pending');
  `);
  const occ = (await CalendarService.getEffectiveSchedule(THU, THU)).find((o: any) => o.id === `rec_1_${THU}`);
  await setOccurrenceStatus(occ, 'present');
  const dump = () => Object.fromEntries(TABLES.map((t) => [t, sqlite.prepare(`SELECT * FROM ${t} ORDER BY id`).all()]));
  const good = JSON.parse(await exportBackup());
  const tables = Object.keys(good.tables).filter((t) => good.tables[t].length);

  await fc.assert(fc.asyncProperty(
    fc.constantFrom(...tables), fc.nat(), fc.nat(), fc.constantFrom(null, '', 'x', -1, 1e308, {}, [], true, '../../SQLite'),
    async (table: string, ri: number, ki: number, value: unknown) => {
      const b = JSON.parse(JSON.stringify(good));
      const row = b.tables[table][ri % b.tables[table].length];
      const key = Object.keys(row)[ki % Object.keys(row).length];
      row[key] = value;
      const before = dump();
      let failed = false;
      try { await importBackup(JSON.stringify(b)); } catch { failed = true; }
      if (failed) expect(dump()).toEqual(before);
      else expect(sqlite.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
      await importBackup(JSON.stringify(good)); // reset for the next run
    }), { numRuns: 120 });
});
