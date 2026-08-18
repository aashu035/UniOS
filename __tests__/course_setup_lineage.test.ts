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
    await db.insert(attendance).values({ componentId: theoryId, date: '2025-01-01', status: 'present' });
    await db.insert(attendance).values({ componentId: theoryId, date: '2025-01-08', status: 'absent' });

    // Lab: 1 present
    await db.insert(attendance).values({ componentId: labId, date: '2025-01-05', status: 'present' });

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
