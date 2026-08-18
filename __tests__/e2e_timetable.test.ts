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
    
    // Calculate the weekday
    const [y, m, d] = todayStr.split('-').map(Number);
    const localDate = new Date(y, m - 1, d, 12, 0, 0);
    const todayWeekday = localDate.getDay(); 

    // 1. Create Workspaces
    const [ws1] = await db.insert(workspaces).values({
      name: 'E2E Course Alpha',
      code: 'E2E-101',
      credits: 3,
      color: '#FF0000'
    }).returning();

    const [ws2] = await db.insert(workspaces).values({
      name: 'E2E Course Beta',
      code: 'E2E-102',
      credits: 3,
      color: '#00FF00'
    }).returning();

    // 2. Create Components
    const [comp1] = await db.insert(courseComponents).values({
      workspaceId: ws1.id,
      type: 'theory',
      durationMinutes: 60
    }).returning();

    const [comp2] = await db.insert(courseComponents).values({
      workspaceId: ws2.id,
      type: 'lab',
      durationMinutes: 120
    }).returning();

    // 3. Create Schedules for today
    await db.insert(recurringSchedules).values({
      componentId: comp1.id,
      dayOfWeek: todayWeekday,
      startTime: '09:00',
      endTime: '10:00'
    });

    await db.insert(recurringSchedules).values({
      componentId: comp2.id,
      dayOfWeek: todayWeekday,
      startTime: '14:00',
      endTime: '16:00'
    });

    // 4. Timetable: Evaluate Effective Schedule
    const effectiveSchedule = await CalendarService.getEffectiveSchedule(todayStr, todayStr);
    const todaysClasses = effectiveSchedule.filter(e => e.date === todayStr);

    const alphaHasClass = todaysClasses.some(e => e.workspaceId === ws1.id);
    const betaHasClass = todaysClasses.some(e => e.workspaceId === ws2.id);

    expect(alphaHasClass).toBe(true);
    expect(betaHasClass).toBe(true);

    // 5. Attendance: Mark Present for Alpha
    await AttendanceRepository.markAttendance(ws1.id, todayStr, 'present', 'E2E test');
    
    const records = await db.select().from(attendance).where(eq(attendance.date, todayStr));
    const alphaRecord = records.find(r => r.componentId === comp1.id);
    
    expect(alphaRecord).toBeDefined();
    expect(alphaRecord?.status).toBe('present');
    expect(alphaRecord?.notes).toBe('E2E test');

    // Verify history calculation
    const history = await AttendanceRepository.getAttendanceHistory(ws1.id);
    expect(history.length).toBe(1);
    expect(history[0].status).toBe('present');
  });
});
