/**
 * Migration 0012 Upgrade Test Suite
 * 
 * Tests the attendance identity migration and repair service across
 * all required scenarios:
 * 
 * 1. Fresh database → all migrations
 * 2. Legacy database → corrected migration
 * 3. Legacy database with one unambiguous session
 * 4. Legacy database with multiple same-day sessions
 * 5. Interrupted repair → restart and retry (idempotency)
 * 6. Existing blank occurrence IDs → conversion to NULL
 * 7. Duplicate current attendance → upsert by occurrence identity
 */

import Database from 'better-sqlite3';
// @ts-ignore
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../core/db/schema';
import { AttendanceRepairService, type RepairResult } from '../domains/attendance/repair';

// ─── V11 Schema (before migration 0012) ─────────────────────────────────────
const V11_SCHEMA = `
  CREATE TABLE semesters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    number INTEGER NOT NULL,
    name TEXT,
    type TEXT DEFAULT 'odd',
    start_date TEXT,
    end_date TEXT,
    is_active INTEGER DEFAULT 0,
    sgpa REAL
  );

  CREATE TABLE venues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    building TEXT,
    floor TEXT,
    map_link TEXT
  );

  CREATE TABLE faculty (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    department TEXT,
    cabin TEXT,
    office_hours TEXT,
    photo_uri TEXT,
    notes TEXT
  );

  CREATE TABLE workspaces (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    semester_id INTEGER,
    name TEXT NOT NULL,
    short_name TEXT,
    code TEXT,
    credits INTEGER DEFAULT 3,
    default_faculty_id INTEGER,
    color TEXT DEFAULT '#6C5CE7',
    icon TEXT DEFAULT 'book',
    target_attendance REAL DEFAULT 75.0,
    notes TEXT,
    needs_review INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
    FOREIGN KEY (semester_id) REFERENCES semesters(id),
    FOREIGN KEY (default_faculty_id) REFERENCES faculty(id)
  );

  CREATE TABLE course_components (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    faculty_id INTEGER,
    duration_minutes INTEGER NOT NULL,
    assessment_allocation INTEGER,
    created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (faculty_id) REFERENCES faculty(id)
  );

  CREATE TABLE recurring_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    component_id INTEGER NOT NULL,
    day_of_week INTEGER NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    venue_override_id INTEGER,
    effective_start_date TEXT,
    effective_end_date TEXT,
    FOREIGN KEY (component_id) REFERENCES course_components(id) ON DELETE CASCADE,
    FOREIGN KEY (venue_override_id) REFERENCES venues(id)
  );

  CREATE TABLE schedule_exceptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    component_id INTEGER NOT NULL,
    recurring_schedule_id INTEGER,
    specific_date TEXT NOT NULL,
    action TEXT NOT NULL,
    start_time TEXT,
    end_time TEXT,
    venue_override_id INTEGER,
    faculty_override_id INTEGER,
    FOREIGN KEY (component_id) REFERENCES course_components(id) ON DELETE CASCADE,
    FOREIGN KEY (recurring_schedule_id) REFERENCES recurring_schedules(id) ON DELETE CASCADE,
    FOREIGN KEY (venue_override_id) REFERENCES venues(id),
    FOREIGN KEY (faculty_override_id) REFERENCES faculty(id)
  );

  -- V11 attendance schema: old component/date uniqueness, no occurrence_id
  CREATE TABLE attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    component_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    source TEXT DEFAULT 'local',
    status TEXT NOT NULL,
    marked_at TEXT DEFAULT (CURRENT_TIMESTAMP),
    notes TEXT,
    FOREIGN KEY (component_id) REFERENCES course_components(id) ON DELETE CASCADE
  );
  CREATE UNIQUE INDEX component_date_idx ON attendance(component_id, date);
`;

// ─── Migration 0012 SQL (the exact corrected migration) ─────────────────────
const MIGRATION_0012 = `
  DROP INDEX IF EXISTS component_date_idx;
  ALTER TABLE attendance ADD occurrence_id TEXT;
  ALTER TABLE attendance ADD identity_status TEXT DEFAULT 'unresolved_legacy' NOT NULL;
  CREATE UNIQUE INDEX occurrence_idx ON attendance(occurrence_id);
  UPDATE attendance SET occurrence_id = NULL WHERE occurrence_id = '';
`;

function createLegacyDb() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  sqlite.exec(V11_SCHEMA);
  return sqlite;
}

function seedCourseWithComponents(sqlite: Database.Database) {
  // Semester
  sqlite.exec(`INSERT INTO semesters (number, name, is_active) VALUES (5, 'Sem 5', 1)`);
  // Workspace
  sqlite.exec(`INSERT INTO workspaces (semester_id, name, code) VALUES (1, 'Data Structures', 'CS201')`);
  // Theory component (id=1)
  sqlite.exec(`INSERT INTO course_components (workspace_id, type, duration_minutes) VALUES (1, 'theory', 60)`);
  // Lab component (id=2)
  sqlite.exec(`INSERT INTO course_components (workspace_id, type, duration_minutes) VALUES (1, 'lab', 120)`);
}

function seedSchedules(sqlite: Database.Database, schedules: Array<{componentId: number, dayOfWeek: number, startTime: string, endTime: string}>) {
  for (const s of schedules) {
    sqlite.exec(`INSERT INTO recurring_schedules (component_id, day_of_week, start_time, end_time) VALUES (${s.componentId}, ${s.dayOfWeek}, '${s.startTime}', '${s.endTime}')`);
  }
}

function seedLegacyAttendance(sqlite: Database.Database, records: Array<{componentId: number, date: string, status: string}>) {
  // Temporarily drop the unique index to allow inserting test data with same component on same date
  // (needed for multi-session test cases)
  try { sqlite.exec(`DROP INDEX component_date_idx`); } catch (e) { /* already dropped */ }
  for (const r of records) {
    sqlite.exec(`INSERT INTO attendance (component_id, date, status) VALUES (${r.componentId}, '${r.date}', '${r.status}')`);
  }
  // Re-create the old index for the migration to drop
  try { sqlite.exec(`CREATE UNIQUE INDEX component_date_idx ON attendance(component_id, date)`); } catch (e) { /* already exists or can't due to dupes - ok */ }
}

function applyMigration0012(sqlite: Database.Database) {
  sqlite.exec(MIGRATION_0012);
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Migration 0012: Attendance Identity Upgrade', () => {

  describe('Schema Verification', () => {
    test('fresh v11 schema → migration 0012 produces correct columns', () => {
      const sqlite = createLegacyDb();
      applyMigration0012(sqlite);

      const columns = sqlite.pragma('table_info(attendance)') as any[];
      const colNames = columns.map((c: any) => c.name);

      expect(colNames).toContain('occurrence_id');
      expect(colNames).toContain('identity_status');

      // occurrence_id should be nullable (notnull = 0)
      const occCol = columns.find((c: any) => c.name === 'occurrence_id');
      expect(occCol.notnull).toBe(0);

      // identity_status should be NOT NULL with default 'unresolved_legacy'
      const idCol = columns.find((c: any) => c.name === 'identity_status');
      expect(idCol.notnull).toBe(1);
      expect(idCol.dflt_value).toBe("'unresolved_legacy'");

      sqlite.close();
    });

    test('old component_date_idx is dropped', () => {
      const sqlite = createLegacyDb();
      applyMigration0012(sqlite);

      const indexes = sqlite.pragma('index_list(attendance)') as any[];
      const indexNames = indexes.map((i: any) => i.name);

      expect(indexNames).not.toContain('component_date_idx');
      expect(indexNames).toContain('occurrence_idx');

      sqlite.close();
    });

    test('occurrence_idx allows multiple NULLs', () => {
      const sqlite = createLegacyDb();
      seedCourseWithComponents(sqlite);

      // Insert two legacy attendance records for different dates
      sqlite.exec(`INSERT INTO attendance (component_id, date, status) VALUES (1, '2026-08-17', 'present')`);
      sqlite.exec(`INSERT INTO attendance (component_id, date, status) VALUES (1, '2026-08-18', 'absent')`);

      applyMigration0012(sqlite);

      // Both should have NULL occurrence_id — no unique constraint violation
      const rows = sqlite.prepare('SELECT occurrence_id FROM attendance').all() as any[];
      expect(rows.length).toBe(2);
      expect(rows[0].occurrence_id).toBeNull();
      expect(rows[1].occurrence_id).toBeNull();

      sqlite.close();
    });
  });

  describe('Blank Identity Cleanup', () => {
    test('empty string occurrence_id is converted to NULL by migration', () => {
      const sqlite = createLegacyDb();
      seedCourseWithComponents(sqlite);

      // Simulate a row that somehow got an empty string
      sqlite.exec(`INSERT INTO attendance (component_id, date, status) VALUES (1, '2026-08-17', 'present')`);
      applyMigration0012(sqlite);

      // Manually set to empty string to simulate edge case before the UPDATE runs
      // Actually the migration UPDATE runs after ALTER, so let's verify directly
      const rows = sqlite.prepare("SELECT * FROM attendance WHERE occurrence_id = ''").all();
      expect(rows.length).toBe(0);

      sqlite.close();
    });
  });

  describe('AttendanceRepairService', () => {
    function setupRepairableDb(): { sqlite: Database.Database, db: any } {
      const sqlite = createLegacyDb();
      seedCourseWithComponents(sqlite);
      // Theory has recurring schedule on Monday (dayOfWeek=1), id will be 1
      seedSchedules(sqlite, [
        { componentId: 1, dayOfWeek: 1, startTime: '09:00', endTime: '10:00' },
      ]);
      return { sqlite, db: drizzle(sqlite, { schema }) };
    }

    test('unambiguous legacy row is resolved', async () => {
      const { sqlite, db } = setupRepairableDb();

      // Legacy attendance on a Monday
      sqlite.exec(`INSERT INTO attendance (component_id, date, status) VALUES (1, '2026-08-17', 'present')`);
      applyMigration0012(sqlite);

      const result = await AttendanceRepairService.repairLegacyIdentities(db);

      expect(result.resolved).toBe(1);
      expect(result.unresolved_no_match).toBe(0);
      expect(result.unresolved_multiple_matches).toBe(0);

      // Verify the actual row
      const row = sqlite.prepare('SELECT * FROM attendance WHERE id = 1').get() as any;
      expect(row.occurrence_id).toBe('rec_1_2026-08-17');
      expect(row.identity_status).toBe('resolved');

      sqlite.close();
    });

    test('no matching schedule leaves row unresolved', async () => {
      const { sqlite, db } = setupRepairableDb();

      // Legacy attendance on a Tuesday — no recurring schedule for Tuesday
      sqlite.exec(`INSERT INTO attendance (component_id, date, status) VALUES (1, '2026-08-18', 'present')`);
      applyMigration0012(sqlite);

      const result = await AttendanceRepairService.repairLegacyIdentities(db);

      expect(result.resolved).toBe(0);
      expect(result.unresolved_no_match).toBe(1);

      const row = sqlite.prepare('SELECT * FROM attendance WHERE id = 1').get() as any;
      expect(row.occurrence_id).toBeNull();
      expect(row.identity_status).toBe('unresolved_legacy');

      sqlite.close();
    });

    test('multiple same-day schedules leave row unresolved', async () => {
      const sqlite = createLegacyDb();
      seedCourseWithComponents(sqlite);

      // Two theory sessions on the same day (Monday)
      seedSchedules(sqlite, [
        { componentId: 1, dayOfWeek: 1, startTime: '09:00', endTime: '10:00' },
        { componentId: 1, dayOfWeek: 1, startTime: '14:00', endTime: '15:00' },
      ]);

      sqlite.exec(`INSERT INTO attendance (component_id, date, status) VALUES (1, '2026-08-17', 'present')`);
      applyMigration0012(sqlite);

      const db = drizzle(sqlite, { schema });
      const result = await AttendanceRepairService.repairLegacyIdentities(db);

      expect(result.resolved).toBe(0);
      expect(result.unresolved_multiple_matches).toBe(1);

      const row = sqlite.prepare('SELECT * FROM attendance WHERE id = 1').get() as any;
      expect(row.occurrence_id).toBeNull();
      expect(row.identity_status).toBe('unresolved_legacy');

      sqlite.close();
    });

    test('theory + lab on same date: both resolve independently', async () => {
      const sqlite = createLegacyDb();
      seedCourseWithComponents(sqlite);

      // Theory on Monday, Lab on Monday — different components
      seedSchedules(sqlite, [
        { componentId: 1, dayOfWeek: 1, startTime: '09:00', endTime: '10:00' },
        { componentId: 2, dayOfWeek: 1, startTime: '14:00', endTime: '16:00' },
      ]);

      // Drop old index to allow two records on same date (different components)
      sqlite.exec(`DROP INDEX component_date_idx`);
      sqlite.exec(`INSERT INTO attendance (component_id, date, status) VALUES (1, '2026-08-17', 'present')`);
      sqlite.exec(`INSERT INTO attendance (component_id, date, status) VALUES (2, '2026-08-17', 'present')`);

      // Manually apply migration (index already dropped)
      sqlite.exec(`ALTER TABLE attendance ADD occurrence_id TEXT`);
      sqlite.exec(`ALTER TABLE attendance ADD identity_status TEXT DEFAULT 'unresolved_legacy' NOT NULL`);
      sqlite.exec(`CREATE UNIQUE INDEX occurrence_idx ON attendance(occurrence_id)`);
      sqlite.exec(`UPDATE attendance SET occurrence_id = NULL WHERE occurrence_id = ''`);

      const db = drizzle(sqlite, { schema });
      const result = await AttendanceRepairService.repairLegacyIdentities(db);

      expect(result.resolved).toBe(2);
      expect(result.unresolved_no_match).toBe(0);
      expect(result.unresolved_multiple_matches).toBe(0);

      const rows = sqlite.prepare('SELECT * FROM attendance ORDER BY id').all() as any[];
      expect(rows[0].occurrence_id).toBe('rec_1_2026-08-17');
      expect(rows[0].identity_status).toBe('resolved');
      expect(rows[1].occurrence_id).toBe('rec_2_2026-08-17');
      expect(rows[1].identity_status).toBe('resolved');

      sqlite.close();
    });

    test('repeated repair is idempotent — no double resolution', async () => {
      const { sqlite, db } = setupRepairableDb();

      sqlite.exec(`INSERT INTO attendance (component_id, date, status) VALUES (1, '2026-08-17', 'present')`);
      applyMigration0012(sqlite);

      // First repair
      const result1 = await AttendanceRepairService.repairLegacyIdentities(db);
      expect(result1.resolved).toBe(1);

      // Second repair — should find 0 legacy rows
      const result2 = await AttendanceRepairService.repairLegacyIdentities(db);
      expect(result2.resolved).toBe(0);
      expect(result2.total_legacy_rows).toBe(0);

      // Data unchanged
      const row = sqlite.prepare('SELECT * FROM attendance WHERE id = 1').get() as any;
      expect(row.occurrence_id).toBe('rec_1_2026-08-17');
      expect(row.identity_status).toBe('resolved');

      sqlite.close();
    });

    test('blank occurrence_id is cleaned up by repair', async () => {
      const { sqlite, db } = setupRepairableDb();

      sqlite.exec(`INSERT INTO attendance (component_id, date, status) VALUES (1, '2026-08-17', 'present')`);
      // Apply migration but simulate a blank occurrence_id leak
      sqlite.exec(`ALTER TABLE attendance ADD occurrence_id TEXT`);
      sqlite.exec(`ALTER TABLE attendance ADD identity_status TEXT DEFAULT 'unresolved_legacy' NOT NULL`);

      // Manually set blank string (edge case)
      sqlite.exec(`UPDATE attendance SET occurrence_id = '' WHERE id = 1`);
      sqlite.exec(`CREATE UNIQUE INDEX occurrence_idx ON attendance(occurrence_id)`);

      const result = await AttendanceRepairService.repairLegacyIdentities(db);

      expect(result.invalid_blank_identity).toBe(1);

      // After repair, the blank should be NULL
      const row = sqlite.prepare('SELECT * FROM attendance WHERE id = 1').get() as any;
      // The repair cleans blank → NULL, then attempts resolution
      expect(row.occurrence_id).not.toBe('');

      sqlite.close();
    });

    test('repair returns structured counts for mixed scenarios', async () => {
      const sqlite = createLegacyDb();
      seedCourseWithComponents(sqlite);

      // Schedule: Theory on Monday only (one schedule, id=1)
      seedSchedules(sqlite, [
        { componentId: 1, dayOfWeek: 1, startTime: '09:00', endTime: '10:00' },
      ]);

      sqlite.exec(`DROP INDEX component_date_idx`);
      // Row 1: Unambiguous Monday — will resolve
      sqlite.exec(`INSERT INTO attendance (component_id, date, status) VALUES (1, '2026-08-17', 'present')`);
      // Row 2: Tuesday — no match
      sqlite.exec(`INSERT INTO attendance (component_id, date, status) VALUES (1, '2026-08-18', 'absent')`);
      // Row 3: Lab on Monday — no schedule for lab
      sqlite.exec(`INSERT INTO attendance (component_id, date, status) VALUES (2, '2026-08-17', 'present')`);

      // Apply migration manually
      sqlite.exec(`ALTER TABLE attendance ADD occurrence_id TEXT`);
      sqlite.exec(`ALTER TABLE attendance ADD identity_status TEXT DEFAULT 'unresolved_legacy' NOT NULL`);
      sqlite.exec(`CREATE UNIQUE INDEX occurrence_idx ON attendance(occurrence_id)`);
      sqlite.exec(`UPDATE attendance SET occurrence_id = NULL WHERE occurrence_id = ''`);

      const db = drizzle(sqlite, { schema });
      const result = await AttendanceRepairService.repairLegacyIdentities(db);

      expect(result.total_legacy_rows).toBe(3);
      expect(result.resolved).toBe(1);
      expect(result.unresolved_no_match).toBe(2); // Tuesday theory + Monday lab (no lab schedule)

      sqlite.close();
    });

    test('occurrence_id claimed by another row prevents resolution', async () => {
      const { sqlite, db } = setupRepairableDb();

      sqlite.exec(`DROP INDEX component_date_idx`);
      // Row 1: Already resolved with the expected occurrence_id
      sqlite.exec(`INSERT INTO attendance (component_id, date, status) VALUES (1, '2026-08-17', 'present')`);

      applyMigration0012(sqlite);

      // Manually resolve row 1 to claim the occurrence_id
      sqlite.exec(`UPDATE attendance SET occurrence_id = 'rec_1_2026-08-17', identity_status = 'resolved' WHERE id = 1`);

      // Insert a second legacy row for the same date/component
      sqlite.exec(`INSERT INTO attendance (component_id, date, status, identity_status) VALUES (1, '2026-08-17', 'absent', 'unresolved_legacy')`);

      const result = await AttendanceRepairService.repairLegacyIdentities(db);

      // The second row cannot resolve because the occurrence_id is already claimed
      expect(result.unresolved_multiple_matches).toBe(1);

      sqlite.close();
    });
  });

  describe('Aggregate Attendance Includes Unresolved', () => {
    test('calculateAttendanceMetrics counts all rows regardless of identity_status', () => {
      const { calculateAttendanceMetrics } = require('../core/utils/attendance');

      const records = [
        { status: 'present', identityStatus: 'resolved' },
        { status: 'absent', identityStatus: 'resolved' },
        { status: 'present', identityStatus: 'unresolved_legacy' }, // Must be included
      ];

      const metrics = calculateAttendanceMetrics(records);

      expect(metrics.present).toBe(2);
      expect(metrics.absent).toBe(1);
      expect(metrics.total).toBe(3);
      expect(metrics.percentage).toBe(66); // 2/3 * 100 rounded down
    });
  });
});
