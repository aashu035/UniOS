import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../core/db/schema';

// Setup in-memory SQLite database with Drizzle ORM
const sqlite = new Database(':memory:');
sqlite.pragma('foreign_keys = ON');

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
`);

const testDb = drizzle(sqlite, { schema });
(testDb as any).transaction = async (cb: any) => {
  return await cb(testDb);
};

jest.mock('../core/db/client', () => ({
  db: testDb,
  expoDb: {
    execSync: (sql: string) => sqlite.exec(sql),
    getFirstSync: (sql: string) => sqlite.prepare(sql).get(),
    getAllAsync: async (sql: string) => sqlite.prepare(sql).all(),
  },
}));

import { db } from '../core/db/client';
import { eq } from 'drizzle-orm';
import { workspaces, courseComponents, componentFacultyAssignments, componentVenueAssignments } from '../domains/workspace/model';
import { recurringSchedules } from '../domains/calendar/model';
import { WorkspaceRepository } from '../domains/workspace/repository';
import { semesters } from '../domains/semester/model';
import { faculty } from '../domains/faculty/model';
import { venues } from '../domains/venue/model';
import { attendance } from '../domains/attendance/model';
import { AttendanceRepository } from '../domains/attendance/repository';
import { getLocalDateString } from '../core/utils/date';

describe('Course Setup Lineage', () => {
  let activeSemesterId: number;

  beforeEach(async () => {
    // Clean slate
    await db.delete(attendance);
    await db.delete(recurringSchedules);
    await db.delete(componentFacultyAssignments);
    await db.delete(componentVenueAssignments);
    await db.delete(courseComponents);
    await db.delete(workspaces);
    await db.delete(faculty);
    await db.delete(venues);
    await db.delete(semesters);

    const [sem] = await db.insert(semesters).values({
      number: 1,
      type: 'Fall',
      isActive: true,
      startDate: '2025-01-01',
      endDate: '2025-06-01'
    }).returning();
    activeSemesterId = sem.id;
  });

  it('preserves and exposes Theory + Lab entities exactly as provisioned', async () => {
    // 1. Provision via buildCompleteWorkspace (Course Setup Wizard Simulator)
    const newCourse = await WorkspaceRepository.buildCompleteWorkspace({
      name: 'Lineage Course',
      code: 'LIN-101',
      credits: 4,
      components: [
        {
          type: 'theory',
          durationMinutes: 60,
          facultyName: 'Dr. Theory',
          venueName: 'Theory Hall',
          sessions: [
            { dayOfWeek: 1, startTime: '09:00', endTime: '10:00' },
            { dayOfWeek: 3, startTime: '09:00', endTime: '10:00' }
          ]
        },
        {
          type: 'lab',
          durationMinutes: 120,
          facultyName: 'Prof. Lab',
          venueName: 'Lab 101',
          sessions: [
            { dayOfWeek: 5, startTime: '14:00', endTime: '16:00' }
          ]
        }
      ]
    });

    // 2. Add Target Attendance
    await WorkspaceRepository.updateCourseIdentity(newCourse.id, { targetAttendance: 75 });

    // 3. Mark Attendance
    const today = getLocalDateString(new Date());
    
    // We need component IDs to explicitly mark
    const comps = await db.select().from(courseComponents).where(eq(courseComponents.workspaceId, newCourse.id)).all();
    const theoryId = comps.find(c => c.type === 'theory')!.id;
    const labId = comps.find(c => c.type === 'lab')!.id;

    // Theory: 1 present, 1 absent
    await db.insert(attendance).values({ occurrenceId: 'theory_occ_1', identityStatus: 'resolved', componentId: theoryId, date: '2025-01-01', status: 'present' });
    await db.insert(attendance).values({ occurrenceId: 'theory_occ_2', identityStatus: 'resolved', componentId: theoryId, date: '2025-01-08', status: 'absent' });

    // Lab: 1 present
    await db.insert(attendance).values({ occurrenceId: 'lab_occ_1', identityStatus: 'resolved', componentId: labId, date: '2025-01-05', status: 'present' });

    // 4. Extract Canonical View Model
    const viewData = await WorkspaceRepository.getCompleteWorkspace(newCourse.id);
    expect(viewData).not.toBeNull();

    // Verify Identity
    expect(viewData!.workspace.name).toBe('Lineage Course');
    expect(viewData!.workspace.code).toBe('LIN-101');
    expect(viewData!.workspace.targetAttendance).toBe(75);

    // Verify Hierarchy
    expect(viewData!.components.length).toBe(2);

    const theoryComp = viewData!.components.find((c: any) => c.type === 'theory');
    const labComp = viewData!.components.find((c: any) => c.type === 'lab');

    // Theory assertions
    expect(theoryComp.activeFacultyName).toBe('Dr. Theory');
    expect(theoryComp.activeVenueName).toBe('Theory Hall');
    expect(theoryComp.schedules.length).toBe(2);
    expect(theoryComp.attendanceMetrics.present).toBe(1);
    expect(theoryComp.attendanceMetrics.total).toBe(2);
    expect(theoryComp.attendanceMetrics.percentage).toBe(50); // 1/2

    // Lab assertions
    expect(labComp.activeFacultyName).toBe('Prof. Lab');
    expect(labComp.activeVenueName).toBe('Lab 101');
    expect(labComp.schedules.length).toBe(1);
    expect(labComp.attendanceMetrics.present).toBe(1);
    expect(labComp.attendanceMetrics.total).toBe(1);
    expect(labComp.attendanceMetrics.percentage).toBe(100); // 1/1
  });

  it('exposes explicit nulls and empty arrays for empty states without manufacturing defaults', async () => {
    // 1. Provision via buildCompleteWorkspace with MINIMAL config
    const newCourse = await WorkspaceRepository.buildCompleteWorkspace({
      name: 'Empty Course',
      code: 'EMP-101',
      components: [
        {
          type: 'theory',
          durationMinutes: 60,
          facultyName: '',
          venueName: '',
          sessions: []
        }
      ]
    });

    const viewData = await WorkspaceRepository.getCompleteWorkspace(newCourse.id);
    
    // Verify Identity
    expect(viewData!.workspace.name).toBe('Empty Course');

    const comp = viewData!.components[0];
    
    // Verify pure empty state
    expect(comp.activeFacultyName).toBeNull();
    expect(comp.activeVenueName).toBeNull();
    expect(comp.schedules).toEqual([]);
    expect(comp.attendanceMetrics.hasData).toBe(false);
    expect(comp.attendanceMetrics.present).toBe(0);
    expect(comp.attendanceMetrics.total).toBe(0);
  });
});
