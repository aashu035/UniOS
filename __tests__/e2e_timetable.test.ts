import Database from 'better-sqlite3';
// @ts-ignore
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
    occurrence_id TEXT NOT NULL,
    date TEXT NOT NULL,
    source TEXT DEFAULT 'local',
    status TEXT NOT NULL,
    marked_at TEXT DEFAULT (CURRENT_TIMESTAMP),
    identity_status TEXT DEFAULT 'pending',
    identity_synced_at TEXT,
    notes TEXT,
    FOREIGN KEY (component_id) REFERENCES course_components(id) ON DELETE CASCADE,
    UNIQUE(occurrence_id)
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


import { db } from '../core/db/client';
import { workspaces, courseComponents } from '../domains/workspace/model';
import { recurringSchedules } from '../domains/calendar/model';
import { CalendarService } from '../domains/calendar/service';
import { getLocalDateString } from '../core/utils/date';
import { eq } from 'drizzle-orm';
import { AttendanceRepository } from '../domains/attendance/repository';
import { attendance } from '../domains/attendance/model';
import { calendarEvents } from '../domains/calendar/model';

describe('E2E Timetable and Attendance', () => {
  beforeEach(async () => {
    // Clear the tables to ensure a clean state
    await db.delete(attendance);
    await db.delete(recurringSchedules);
    await db.delete(courseComponents);
    await db.delete(workspaces);
    await db.delete(calendarEvents);
  });

  it('should render two courses scheduled for today and mark attendance correctly', async () => {
    const today = new Date();
    const todayStr = getLocalDateString(today);
    
    const [y, m, d] = todayStr.split('-').map(Number);
    const localDate = new Date(y, m - 1, d, 12, 0, 0);
    const todayWeekday = localDate.getDay(); 

    const [ws1] = await db.insert(workspaces).values({
      name: 'E2E Course Alpha', code: 'E2E-101', credits: 3, color: '#FF0000'
    }).returning();

    const [ws2] = await db.insert(workspaces).values({
      name: 'E2E Course Beta', code: 'E2E-102', credits: 3, color: '#00FF00'
    }).returning();

    const [comp1] = await db.insert(courseComponents).values({
      workspaceId: ws1.id, type: 'theory', durationMinutes: 60
    }).returning();

    const [comp2] = await db.insert(courseComponents).values({
      workspaceId: ws2.id, type: 'lab', durationMinutes: 120
    }).returning();

    await db.insert(recurringSchedules).values({
      componentId: comp1.id, dayOfWeek: todayWeekday, startTime: '09:00', endTime: '10:00'
    });

    await db.insert(recurringSchedules).values({
      componentId: comp2.id, dayOfWeek: todayWeekday, startTime: '14:00', endTime: '16:00'
    });

    const effectiveSchedule = await CalendarService.getEffectiveSchedule(todayStr, todayStr);
    const todaysClasses = effectiveSchedule.filter(e => e.date === todayStr);

    const alphaHasClass = todaysClasses.some(e => e.workspaceId === ws1.id);
    const betaHasClass = todaysClasses.some(e => e.workspaceId === ws2.id);

    expect(alphaHasClass).toBe(true);
    expect(betaHasClass).toBe(true);

    const alphaOcc = todaysClasses.find(e => e.workspaceId === ws1.id);
    
    // Attendance: Mark Present for Alpha (fixing args to include occId and compId)
    await AttendanceRepository.markAttendance(ws1.id, todayStr, 'present', alphaOcc!.id, alphaOcc!.componentId!, 'E2E test');
    
    const records = await db.select().from(attendance).where(eq(attendance.date, todayStr));
    const alphaRecord = records.find(r => r.componentId === comp1.id);
    
    expect(alphaRecord).toBeDefined();
    expect(alphaRecord?.status).toBe('present');
    expect(alphaRecord?.notes).toBe('E2E test');

    const history = await AttendanceRepository.getAttendanceHistory(ws1.id);
    expect(history.length).toBe(1);
    expect(history[0].status).toBe('present');
  });
});
