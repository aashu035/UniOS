import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../core/db/schema';

// Setup in-memory SQLite database with Drizzle ORM
const sqlite = new Database(':memory:');
sqlite.pragma('foreign_keys = ON');

// Initialize schema tables
sqlite.exec(`
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

  CREATE TABLE component_venue_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    component_id INTEGER NOT NULL,
    venue_id INTEGER NOT NULL,
    effective_from TEXT NOT NULL,
    effective_until TEXT,
    FOREIGN KEY (component_id) REFERENCES course_components(id) ON DELETE CASCADE,
    FOREIGN KEY (venue_id) REFERENCES venues(id)
  );

  CREATE TABLE component_faculty_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    component_id INTEGER NOT NULL,
    faculty_id INTEGER NOT NULL,
    effective_from TEXT NOT NULL,
    effective_until TEXT,
    FOREIGN KEY (component_id) REFERENCES course_components(id) ON DELETE CASCADE,
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

  CREATE TABLE calendar_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id INTEGER,
    title TEXT,
    description TEXT,
    day_of_week INTEGER,
    specific_date TEXT,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    type TEXT DEFAULT 'lecture',
    venue_override_id INTEGER,
    location TEXT,
    recurrence_group_id TEXT,
    end_date TEXT,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (venue_override_id) REFERENCES venues(id)
  );

  CREATE TABLE attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    component_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    source TEXT DEFAULT 'local',
    status TEXT NOT NULL,
    marked_at TEXT DEFAULT (CURRENT_TIMESTAMP),
    notes TEXT,
    FOREIGN KEY (component_id) REFERENCES course_components(id) ON DELETE CASCADE,
    UNIQUE(component_id, date)
  );

  CREATE TABLE portal_attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id INTEGER NOT NULL,
    component_id INTEGER,
    portal_total INTEGER,
    portal_present INTEGER,
    portal_percent REAL,
    checked_date TEXT NOT NULL,
    screenshot_uri TEXT,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (component_id) REFERENCES course_components(id) ON DELETE CASCADE
  );

  CREATE TABLE tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id INTEGER,
    title TEXT NOT NULL,
    description TEXT,
    type TEXT DEFAULT 'assignment',
    due_date TEXT,
    priority TEXT DEFAULT 'medium',
    status TEXT DEFAULT 'pending',
    marks_obtained REAL,
    marks_total REAL,
    feedback TEXT,
    file_uris TEXT,
    created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
  );

  CREATE TABLE resources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id INTEGER,
    title TEXT NOT NULL,
    description TEXT,
    type TEXT DEFAULT 'pdf',
    uri TEXT,
    size_bytes INTEGER,
    tags TEXT,
    created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
  );

  CREATE TABLE workspace_timeline (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id INTEGER,
    event_type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    timestamp TEXT DEFAULT (CURRENT_TIMESTAMP),
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
  );

  CREATE TABLE students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    enrollment_no TEXT,
    university TEXT,
    branch TEXT,
    current_semester INTEGER,
    target_cgpa REAL
  );
`);

const testDb = drizzle(sqlite, { schema });
(testDb as any).transaction = async (cb: any) => {
  return await cb(testDb);
};

// Mock client to use our real in-memory database
jest.mock('../core/db/client', () => ({
  db: testDb,
  expoDb: {
    execSync: (sql: string) => sqlite.exec(sql),
    getFirstSync: (sql: string) => sqlite.prepare(sql).get(),
    getAllAsync: async (sql: string) => sqlite.prepare(sql).all(),
  },
}));

import { WorkspaceRepository } from '../domains/workspace/repository';
import { CalendarService } from '../domains/calendar/service';
import { AttendanceRepository } from '../domains/attendance/repository';
import { TaskRepository } from '../domains/task/repository';
import { calculateAttendanceMetrics } from '../core/utils/attendance';

describe('Phase B.5 — Forensic Rectification Verification Suite', () => {
  beforeAll(async () => {
    // Insert active semester
    sqlite.exec(`INSERT INTO semesters (id, number, name, is_active) VALUES (1, 5, 'Semester 5', 1)`);
  });

  // TEST 1 — Course persistence
  it('Test 1 — Course persistence: creates course with Theory + Lab and verifies all DB tables directly', async () => {
    const coursePayload = {
      name: 'Embedded System',
      code: 'ESECE301D',
      credits: 4,
      color: '#6C5CE7',
      icon: 'cpu',
      components: [
        {
          type: 'theory' as const,
          facultyName: 'Dr. RD',
          venueName: 'JCB 213',
          durationMinutes: 60,
          sessions: [
            { dayOfWeek: 1, startTime: '09:00', endTime: '10:00' }, // Monday
          ],
        },
        {
          type: 'lab' as const,
          facultyName: 'Dr. XYZ',
          venueName: 'Lab X',
          durationMinutes: 120,
          sessions: [
            { dayOfWeek: 3, startTime: '14:00', endTime: '16:00' }, // Wednesday
          ],
        },
      ],
    };

    const workspace = await WorkspaceRepository.buildCompleteWorkspace(coursePayload);
    expect(workspace).toBeDefined();
    expect(workspace.id).toBeGreaterThan(0);

    // Direct SQLite queries verifying raw database state
    const wsRow = sqlite.prepare('SELECT * FROM workspaces WHERE id = ?').get(workspace.id) as any;
    expect(wsRow.name).toBe('Embedded System');
    expect(wsRow.code).toBe('ESECE301D');
    expect(wsRow.credits).toBe(4);
    expect(wsRow.icon).toBe('cpu');

    // Verify course_components
    const compRows = sqlite.prepare('SELECT * FROM course_components WHERE workspace_id = ? ORDER BY id ASC').all(workspace.id) as any[];
    expect(compRows).toHaveLength(2);
    expect(compRows[0].type).toBe('theory');
    expect(compRows[0].duration_minutes).toBe(60);
    expect(compRows[1].type).toBe('lab');
    expect(compRows[1].duration_minutes).toBe(120);

    // Verify faculty table
    const facRD = sqlite.prepare('SELECT * FROM faculty WHERE name = ?').get('Dr. RD') as any;
    const facXYZ = sqlite.prepare('SELECT * FROM faculty WHERE name = ?').get('Dr. XYZ') as any;
    expect(facRD).toBeDefined();
    expect(facXYZ).toBeDefined();

    // Verify venues table
    const venJCB = sqlite.prepare('SELECT * FROM venues WHERE name = ?').get('JCB 213') as any;
    const venLabX = sqlite.prepare('SELECT * FROM venues WHERE name = ?').get('Lab X') as any;
    expect(venJCB).toBeDefined();
    expect(venLabX).toBeDefined();

    // Verify component_faculty_assignments
    const facAssignTheory = sqlite.prepare('SELECT * FROM component_faculty_assignments WHERE component_id = ?').get(compRows[0].id) as any;
    const facAssignLab = sqlite.prepare('SELECT * FROM component_faculty_assignments WHERE component_id = ?').get(compRows[1].id) as any;
    expect(facAssignTheory.faculty_id).toBe(facRD.id);
    expect(facAssignLab.faculty_id).toBe(facXYZ.id);

    // Verify component_venue_assignments
    const venAssignTheory = sqlite.prepare('SELECT * FROM component_venue_assignments WHERE component_id = ?').get(compRows[0].id) as any;
    const venAssignLab = sqlite.prepare('SELECT * FROM component_venue_assignments WHERE component_id = ?').get(compRows[1].id) as any;
    expect(venAssignTheory.venue_id).toBe(venJCB.id);
    expect(venAssignLab.venue_id).toBe(venLabX.id);

    // Verify recurring_schedules
    const schedTheory = sqlite.prepare('SELECT * FROM recurring_schedules WHERE component_id = ?').get(compRows[0].id) as any;
    const schedLab = sqlite.prepare('SELECT * FROM recurring_schedules WHERE component_id = ?').get(compRows[1].id) as any;
    expect(schedTheory.day_of_week).toBe(1);
    expect(schedTheory.start_time).toBe('09:00');
    expect(schedTheory.end_time).toBe('10:00');
    expect(schedLab.day_of_week).toBe(3);
    expect(schedLab.start_time).toBe('14:00');
    expect(schedLab.end_time).toBe('16:00');
  });

  // TEST 2 — Course read-back (getCompleteWorkspace)
  it('Test 2 — Course read-back: getCompleteWorkspace returns enriched components, faculty, venue, schedules', async () => {
    const wsRow = sqlite.prepare("SELECT id FROM workspaces WHERE name = 'Embedded System'").get() as any;
    expect(wsRow).toBeDefined();

    const complete = await WorkspaceRepository.getCompleteWorkspace(wsRow.id);
    expect(complete).toBeDefined();
    expect(complete!.workspace.name).toBe('Embedded System');
    expect(complete!.workspace.code).toBe('ESECE301D');
    expect(complete!.workspace.credits).toBe(4);
    expect(complete!.workspace.icon).toBe('cpu');

    // Primary faculty & venue (resolved from active assignment, eliminating Root Cause A)
    expect(complete!.faculty?.name).toBe('Dr. RD');
    expect(complete!.venue?.name).toBe('JCB 213');

    // Components array with active faculty and venue resolved per component
    expect(complete!.components).toHaveLength(2);
    const theoryComp = complete!.components.find((c: any) => c.type === 'theory');
    const labComp = complete!.components.find((c: any) => c.type === 'lab');

    expect(theoryComp).toBeDefined();
    expect(theoryComp.activeFacultyName).toBe('Dr. RD');
    expect(theoryComp.activeVenueName).toBe('JCB 213');
    expect(theoryComp.durationMinutes).toBe(60);
    expect(theoryComp.schedules).toHaveLength(1);
    expect(theoryComp.schedules[0].dayOfWeek).toBe(1);
    expect(theoryComp.schedules[0].startTime).toBe('09:00');

    expect(labComp).toBeDefined();
    expect(labComp.activeFacultyName).toBe('Dr. XYZ');
    expect(labComp.activeVenueName).toBe('Lab X');
    expect(labComp.durationMinutes).toBe(120);
    expect(labComp.schedules).toHaveLength(1);
    expect(labComp.schedules[0].dayOfWeek).toBe(3);
    expect(labComp.schedules[0].startTime).toBe('14:00');
  });

  // TEST 3 — Timetable integrity
  it('Test 3 — Timetable integrity: 2 courses on Monday both appear in CalendarService.getEffectiveSchedule', async () => {
    // Create second course also on Monday
    const courseBPayload = {
      name: 'Computer Networks',
      code: 'CSE302D',
      credits: 3,
      components: [
        {
          type: 'theory' as const,
          facultyName: 'Dr. Sharma',
          venueName: 'Room 304',
          durationMinutes: 60,
          sessions: [
            { dayOfWeek: 1, startTime: '11:00', endTime: '12:00' }, // Monday 11:00
          ],
        },
      ],
    };

    await WorkspaceRepository.buildCompleteWorkspace(courseBPayload);

    // 2026-08-17 is a Monday
    const mondayStr = '2026-08-17';
    const schedule = await CalendarService.getEffectiveSchedule(mondayStr, mondayStr);

    expect(schedule).toBeDefined();
    // Both Embedded System (09:00-10:00) and Computer Networks (11:00-12:00) must appear!
    const embeddedOcc = schedule.find(s => s.workspaceName === 'Embedded System');
    const networksOcc = schedule.find(s => s.workspaceName === 'Computer Networks');

    expect(embeddedOcc).toBeDefined();
    expect(embeddedOcc!.startTime).toBe('09:00');
    expect(embeddedOcc!.endTime).toBe('10:00');
    expect(embeddedOcc!.venueName).toBe('JCB 213');
    expect(embeddedOcc!.facultyName).toBe('Dr. RD');

    expect(networksOcc).toBeDefined();
    expect(networksOcc!.startTime).toBe('11:00');
    expect(networksOcc!.endTime).toBe('12:00');
    expect(networksOcc!.venueName).toBe('Room 304');
    expect(networksOcc!.facultyName).toBe('Dr. Sharma');

    // Total must include both
    expect(schedule.filter(s => s.date === mondayStr).length).toBeGreaterThanOrEqual(2);
  });

  // TEST 4 — Attendance detection (hasClassToday)
  it('Test 4 — Attendance detection: course with recurring_schedules detects class on scheduled days, false on non-scheduled days', async () => {
    const wsRow = sqlite.prepare("SELECT id FROM workspaces WHERE name = 'Embedded System'").get() as any;

    // 2026-08-17 is Monday (day 1) -> Embedded System has Theory scheduled -> TRUE
    const mondayStr = '2026-08-17';
    const mondaySchedule = await CalendarService.getEffectiveSchedule(mondayStr, mondayStr);
    const hasClassMonday = mondaySchedule.some(e => e.workspaceId === wsRow.id);
    expect(hasClassMonday).toBe(true);

    // 2026-08-18 is Tuesday (day 2) -> Embedded System has no session -> FALSE
    const tuesdayStr = '2026-08-18';
    const tuesdaySchedule = await CalendarService.getEffectiveSchedule(tuesdayStr, tuesdayStr);
    const hasClassTuesday = tuesdaySchedule.some(e => e.workspaceId === wsRow.id);
    expect(hasClassTuesday).toBe(false);

    // 2026-08-19 is Wednesday (day 3) -> Embedded System has Lab scheduled -> TRUE
    const wednesdayStr = '2026-08-19';
    const wednesdaySchedule = await CalendarService.getEffectiveSchedule(wednesdayStr, wednesdayStr);
    const hasClassWednesday = wednesdaySchedule.some(e => e.workspaceId === wsRow.id);
    expect(hasClassWednesday).toBe(true);
  });

  // TEST 5 — Attendance marking
  it('Test 5 — Attendance marking: marking present updates database and recalculates metrics to 100%', async () => {
    const wsRow = sqlite.prepare("SELECT id FROM workspaces WHERE name = 'Embedded System'").get() as any;

    // Mark attendance for Monday session
    const marked = await AttendanceRepository.markAttendance(wsRow.id, '2026-08-17', 'present', 'Lecture 1');
    expect(marked).toBeDefined();
    expect(marked.status).toBe('present');

    // Verify row in attendance table
    const attRow = sqlite.prepare('SELECT * FROM attendance WHERE date = ?').get('2026-08-17') as any;
    expect(attRow).toBeDefined();
    expect(attRow.status).toBe('present');

    // Retrieve attendance history and verify metrics
    const history = await AttendanceRepository.getAttendanceHistory(wsRow.id);
    expect(history).toHaveLength(1);
    expect(history[0].status).toBe('present');
    expect(history[0].componentType).toBe('theory');

    const metrics1 = calculateAttendanceMetrics(history);
    expect(metrics1.hasData).toBe(true);
    expect(metrics1.present).toBe(1);
    expect(metrics1.absent).toBe(0);
    expect(metrics1.total).toBe(1);
    expect(metrics1.percentage).toBe(100);

    // Mark second date as absent
    await AttendanceRepository.markAttendance(wsRow.id, '2026-08-24', 'absent');
    const updatedHistory = await AttendanceRepository.getAttendanceHistory(wsRow.id);
    expect(updatedHistory).toHaveLength(2);

    const metrics2 = calculateAttendanceMetrics(updatedHistory);
    expect(metrics2.present).toBe(1);
    expect(metrics2.absent).toBe(1);
    expect(metrics2.total).toBe(2);
    expect(metrics2.percentage).toBe(50); // 1 / 2 = 50%
  });

  // TEST 6 — Multi-component attendance resolution
  it('Test 6 — Multi-component attendance: automatically resolves to scheduled component on that date without ambiguity error', async () => {
    const wsRow = sqlite.prepare("SELECT id FROM workspaces WHERE name = 'Embedded System'").get() as any;
    const comps = sqlite.prepare('SELECT * FROM course_components WHERE workspace_id = ?').all(wsRow.id) as any[];
    const theoryComp = comps.find(c => c.type === 'theory');
    const labComp = comps.find(c => c.type === 'lab');

    // Wednesday (2026-08-19) is Lab day
    const wednesdayStr = '2026-08-19';
    const markedLab = await AttendanceRepository.markAttendance(wsRow.id, wednesdayStr, 'present', 'Lab Session 1');
    expect(markedLab).toBeDefined();
    expect(markedLab.componentId).toBe(labComp.id);

    // Verify raw DB row is linked to the lab component
    const labAttRow = sqlite.prepare('SELECT * FROM attendance WHERE date = ?').get(wednesdayStr) as any;
    expect(labAttRow.component_id).toBe(labComp.id);
  });

  // TEST 7 — Target vs Actual attendance differentiation
  it('Test 7 — Target vs Actual: 0 records returns null percentage (not target 75%), 1 present returns 100%', async () => {
    // Create new fresh course
    const freshCourse = await WorkspaceRepository.buildCompleteWorkspace({
      name: 'Discrete Math',
      code: 'MTH301',
      credits: 3,
      components: [
        {
          type: 'theory' as const,
          facultyName: 'Dr. John',
          venueName: 'Room 101',
          durationMinutes: 60,
          sessions: [{ dayOfWeek: 2, startTime: '10:00', endTime: '11:00' }],
        },
      ],
    });

    const complete = await WorkspaceRepository.getCompleteWorkspace(freshCourse.id);
    expect(complete!.workspace.targetAttendance).toBe(75.0);

    // Initial state: 0 records
    const initialHistory = await AttendanceRepository.getAttendanceHistory(freshCourse.id);
    expect(initialHistory).toHaveLength(0);

    const initialMetrics = calculateAttendanceMetrics(initialHistory);
    // MUST be null (indicating "No Data" / "-") and NOT 75
    expect(initialMetrics.percentage).toBeNull();
    expect(initialMetrics.hasData).toBe(false);
    expect(initialMetrics.total).toBe(0);

    // After 1 Present record
    await AttendanceRepository.markAttendance(freshCourse.id, '2026-08-18', 'present');
    const updatedHistory = await AttendanceRepository.getAttendanceHistory(freshCourse.id);
    const updatedMetrics = calculateAttendanceMetrics(updatedHistory);

    expect(updatedMetrics.percentage).toBe(100);
    expect(updatedMetrics.hasData).toBe(true);
    expect(updatedMetrics.present).toBe(1);
    expect(updatedMetrics.total).toBe(1);

    // Target attendance remains unchanged at 75.0
    expect(complete!.workspace.targetAttendance).toBe(75.0);
  });

  // TEST 8 — Task persistence and status toggle
  it('Test 8 — Task persistence and status toggle via TaskRepository', async () => {
    const wsRow = sqlite.prepare("SELECT id FROM workspaces WHERE name = 'Embedded System'").get() as any;

    const task = await TaskRepository.createTask({
      workspaceId: wsRow.id,
      title: 'Lab 1 Report',
      type: 'assignment',
      dueDate: '2026-08-25',
      priority: 'high',
      status: 'pending',
    });

    expect(task).toBeDefined();
    expect(task.status).toBe('pending');

    // Toggle to completed
    const updated = await TaskRepository.updateTaskStatus(task.id, 'completed');
    expect(updated.status).toBe('completed');

    // Verify direct SQLite DB row
    const taskRow = sqlite.prepare('SELECT * FROM tasks WHERE id = ?').get(task.id) as any;
    expect(taskRow.status).toBe('completed');

    // Fetch all tasks with workspace info
    const allTasks = await TaskRepository.getAllTasksWithWorkspaces();
    const found = allTasks.find(t => t.id === task.id);
    expect(found).toBeDefined();
    expect(found!.workspaceName).toBe('Embedded System');
    expect(found!.status).toBe('completed');
  });
});
