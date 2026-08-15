const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'test.db');
if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
const db = new DatabaseSync(dbPath);

console.log("1. Applying migrations 0000 - 0007...");
db.exec(`
  CREATE TABLE semesters (id integer PRIMARY KEY AUTOINCREMENT, number integer, name text, is_active integer);
  CREATE TABLE venues (id integer PRIMARY KEY AUTOINCREMENT, name text);
  CREATE TABLE faculty (id integer PRIMARY KEY AUTOINCREMENT, name text);
  
  CREATE TABLE workspaces (
    id integer PRIMARY KEY AUTOINCREMENT, 
    semester_id integer, name text, short_name text, code text, credits integer, 
    type text, faculty_id integer, venue_id integer, color text, 
    target_attendance real, notes text, created_at text
  );
  
  CREATE TABLE attendance (
    id integer PRIMARY KEY AUTOINCREMENT, 
    workspace_id integer, date text, status text, marked_at text, notes text
  );
  
  CREATE TABLE portal_attendance (
    id integer PRIMARY KEY AUTOINCREMENT, 
    workspace_id integer, portal_total integer, portal_present integer, 
    portal_percent real, checked_date text, screenshot_uri text
  );
  
  CREATE TABLE calendar_events (
    id integer PRIMARY KEY AUTOINCREMENT, 
    workspace_id integer, title text, description text, 
    day_of_week integer, specific_date text, start_time text, end_time text, 
    type text, venue_override_id integer, faculty_override_id integer, 
    location text, recurrence_group_id text, batch text, end_date text
  );
`);

console.log("2. Inserting legacy mock data...");
db.exec(`
  -- Setup Semesters, Venues, Faculty
  INSERT INTO semesters (id, number, name, is_active) VALUES (1, 1, 'Fall 2024', 1);
  INSERT INTO venues (id, name) VALUES (1, 'Room 101'), (2, 'Lab A');
  INSERT INTO faculty (id, name) VALUES (1, 'Prof. Smith'), (2, 'Dr. Jones');

  -- Create Legacy Workspaces (Theory, Lab, Unspecified)
  INSERT INTO workspaces (id, semester_id, name, type, faculty_id, venue_id) 
  VALUES 
    (1, 1, 'Embedded Systems', 'theory', 1, 1),
    (2, 1, 'Embedded Systems Lab', 'lab', 2, 2),
    (3, 1, 'Mystery Course', 'elective', NULL, NULL);

  -- Legacy Attendance
  INSERT INTO attendance (id, workspace_id, date, status) 
  VALUES 
    (1, 1, '2024-09-01', 'present'),
    (2, 2, '2024-09-02', 'absent');

  -- Legacy Portal Attendance
  INSERT INTO portal_attendance (id, workspace_id, portal_total, portal_present, checked_date)
  VALUES (1, 1, 10, 8, '2024-09-10');

  -- Legacy Calendar Events (Recurring and Exception)
  INSERT INTO calendar_events (id, workspace_id, day_of_week, start_time, end_time, venue_override_id)
  VALUES (1, 1, 1, '09:00', '10:00', NULL); -- Monday 9-10 (Recurring)
  
  INSERT INTO calendar_events (id, workspace_id, specific_date, start_time, end_time, venue_override_id)
  VALUES (2, 2, '2024-09-15', '14:00', '16:00', 1); -- Sept 15 (Exception/Extra)
`);

console.log("3. Applying migration 0008 (Academic Refactor)...");
const migration0008 = fs.readFileSync(path.join(__dirname, 'drizzle', '0008_academic_refactor.sql'), 'utf8');
try {
    const stmts = migration0008.split('--> statement-breakpoint');
    for (const stmt of stmts) {
        if (stmt.trim()) {
            db.exec(stmt);
        }
    }
    console.log("✅ Migration 0008 executed successfully!");
} catch (e) {
    console.error("❌ Migration failed:", e.message);
    process.exit(1);
}

const assert = require('assert');

console.log("\n4. Verifying migrated data with strict assertions...");

// 1. Every legacy course preserved & ambiguous courses marked NEEDS_REVIEW
const workspaces = db.prepare(`SELECT * FROM workspaces`).all();
assert.strictEqual(workspaces.length, 3, "All 3 legacy courses should be preserved");
const needsReviewCount = workspaces.filter(w => w.needs_review === 1).length;
assert.strictEqual(needsReviewCount, 3, "All migrated workspaces should be marked for review");

// 2. Component mapping & durations (Theory=60, Lab=120)
const components = db.prepare(`SELECT * FROM course_components`).all();
assert.strictEqual(components.length, 3, "Exactly 3 components should be created");
const labComp = components.find(c => c.workspace_id === 2);
assert.strictEqual(labComp.type, 'lab', "Lab component type preserved");
assert.strictEqual(labComp.duration_minutes, 120, "Lab duration should be 120 minutes");
const theoryComp = components.find(c => c.workspace_id === 1);
assert.strictEqual(theoryComp.type, 'theory', "Theory component type preserved");
assert.strictEqual(theoryComp.duration_minutes, 60, "Theory duration should be 60 minutes");
const mysteryComp = components.find(c => c.workspace_id === 3);
assert.strictEqual(mysteryComp.type, 'theory', "Unknown type should default to theory");

// 3. Ambiguous legacy handling (NEEDS_REVIEW courses have NO fabricated structure)
const needsReviewWorkspaces = db.prepare(`SELECT id FROM workspaces WHERE needs_review = 1`).all();
for (const w of needsReviewWorkspaces) {
    const comps = db.prepare(`SELECT * FROM course_components WHERE workspace_id = ?`).all(w.id);
    assert.strictEqual(comps.length, 1, `NEEDS_REVIEW workspace ${w.id} should not have fabricated multi-component structure`);
}

// 4. Faculty/Venue references preserved without duplication
const assignments = db.prepare(`SELECT * FROM component_venue_assignments`).all();
assert.strictEqual(assignments.length, 2, "Only workspaces with venues should get assignments");
assert.strictEqual(assignments.find(a => a.component_id === labComp.id).venue_id, 2, "Lab venue preserved");

assert.strictEqual(workspaces.find(w => w.id === 1).default_faculty_id, 1, "Faculty preserved on workspace");

// 5. No attendance rows lost
const attendanceRows = db.prepare(`SELECT * FROM attendance`).all();
assert.strictEqual(attendanceRows.length, 2, "All attendance rows preserved");
assert.strictEqual(attendanceRows.find(a => a.component_id === theoryComp.id).status, 'present', "Attendance correctly mapped to component");

// 6. Portal snapshots preserved
const portalRows = db.prepare(`SELECT * FROM portal_attendance`).all();
assert.strictEqual(portalRows.length, 1, "Portal attendance preserved");
assert.strictEqual(portalRows[0].portal_total, 10, "Portal metrics preserved");

// 7. Calendar events correctly classified
const recurring = db.prepare(`SELECT * FROM recurring_schedules`).all();
assert.strictEqual(recurring.length, 1, "One recurring schedule should exist");
assert.strictEqual(recurring[0].day_of_week, 1, "Recurring schedule mapped correctly");
assert.strictEqual(recurring[0].component_id, theoryComp.id, "Recurring schedule linked to correct component");

const exceptions = db.prepare(`SELECT * FROM schedule_exceptions`).all();
assert.strictEqual(exceptions.length, 1, "One schedule exception should exist");
assert.strictEqual(exceptions[0].specific_date, '2024-09-15', "Exception date mapped correctly");
assert.strictEqual(exceptions[0].action, 'extra', "Exception action is extra");
assert.strictEqual(exceptions[0].start_time, '14:00', "Start time mapped correctly");

// 8. Foreign keys valid (SQLite PRAGMA foreign_key_check)
const fkCheck = db.prepare(`PRAGMA foreign_key_check`).all();
assert.strictEqual(fkCheck.length, 0, "Foreign key integrity violated: " + JSON.stringify(fkCheck));

// 9. Replay Safety / Idempotency
try {
  // If we try to run it again, it should either be a no-op (if tracked) or throw a predictable error (if raw SQL without IF NOT EXISTS)
  // Drizzle's auto-migrator tracks it, but if we execute raw SQL again, the new tables will cause an error unless handled.
  // The raw SQL does NOT have IF NOT EXISTS because drizzle-kit doesn't generate them for create table.
  // We can assert that running it blindly fails due to table exists, which prevents silent data corruption/duplication.
  db.exec(migration0008);
  assert.fail("Migration SQL should not be replayable blindly without Drizzle's migration tracker");
} catch (err) {
  assert.ok(err.message.includes("table") || err.message.includes("already exists"), `Replay correctly blocked. Error was: ${err.message}`);
}

console.log("✅ All invariants perfectly verified! Phase A migration is rock-solid.");
db.close();
