/**
 * Tests written to break the app, not to confirm it.
 *
 * They run on drizzle's expo-sqlite driver (testing/expoSqliteHarness.ts), so
 * transactions behave as on the phone. Each test states the behaviour a student
 * would expect; where the app disagrees, the test fails and the app is fixed.
 */
import { counts, createDeviceDb } from '../testing/expoSqliteHarness';

const mockDevice: { db?: any; expoDb?: any } = {};
jest.mock('../core/db/client', () => ({
  get db() { return mockDevice.db; },
  get expoDb() { return mockDevice.expoDb; },
}));

const { WorkspaceRepository } = require('../domains/workspace/repository');
const { TaskRepository } = require('../domains/task/repository');
const { SemesterRepository } = require('../domains/semester/repository');
const { DayRuleRepository } = require('../domains/calendar/dayRules');
const { ScheduleExceptionRepository } = require('../domains/calendar/exceptions');
const { CalendarService } = require('../domains/calendar/service');
const { setOccurrenceStatus } = require('../domains/academic/actions');
const { loadSnapshot } = require('../domains/academic/snapshot');
const { exportBackup, importBackup } = require('../core/db/backup');

const THU = '2026-10-29';
const FRI = '2026-10-30';
const TUE = '2026-10-27';
let sqlite: any;

beforeEach(() => {
  const h = createDeviceDb();
  mockDevice.db = h.db;
  mockDevice.expoDb = h.expoDb;
  sqlite = h.sqlite;
  sqlite.exec(`
    INSERT INTO semesters (id, number, name, start_date, is_active) VALUES (1, 5, 'Sem 5', '2026-07-01', 1);
    INSERT INTO workspaces (id, semester_id, name, color, target_attendance) VALUES (1, 1, 'Operating Systems', '#000', 75), (2, 1, 'Computer Networks', '#000', 75);
    INSERT INTO course_components (id, workspace_id, type, duration_minutes) VALUES (1, 1, 'theory', 60), (2, 2, 'theory', 60);
    -- OS Thu 9-10 and Fri 12-13; CN Fri 10-11
    INSERT INTO recurring_schedules (id, component_id, day_of_week, start_time, end_time) VALUES
      (1, 1, 4, '09:00', '10:00'), (2, 2, 5, '10:00', '11:00'), (3, 1, 5, '12:00', '13:00');
    INSERT INTO faculty (id, name) VALUES (1, 'Dr. RD');
    INSERT INTO tasks (id, workspace_id, title, type, due_date, priority, status) VALUES (1, 1, 'OS assignment', 'assignment', '2026-11-02', 'high', 'pending');
  `);
});

const occ = async (date: string, id: string) => {
  const o = (await CalendarService.getEffectiveSchedule(date, date)).find((x: any) => x.id === id);
  if (!o) throw new Error(`${id} is not on the timetable for ${date}`);
  return o;
};
const att = async (workspaceId: number) => {
  const s = await loadSnapshot({ today: '2026-11-05', from: '2026-10-01', to: '2026-11-30' });
  return s.courseById.get(workspaceId).att;
};

describe('transactions behave like transactions', () => {
  it('a restore that fails half way leaves your data as it was', async () => {
    const good = JSON.parse(await exportBackup());
    // A corrupted or hand-edited backup: passes validation, fails at the database
    // (a task without a title breaks NOT NULL), after the wipe has started.
    good.tables.tasks = [{ ...good.tables.tasks[0], title: null }];
    const err = await importBackup(JSON.stringify(good)).then(() => null, (e: any) => e);
    expect(String(err?.message)).toMatch(/NOT NULL/); // the database refused it, not the validator
    expect(counts(sqlite, ['workspaces', 'course_components', 'recurring_schedules', 'tasks', 'semesters'])).toEqual({
      workspaces: 2, course_components: 2, recurring_schedules: 3, tasks: 1, semesters: 1,
    });
    expect(sqlite.prepare('SELECT title FROM tasks').get().title).toBe('OS assignment');
  });

  it('a course that fails to save leaves no half-made course, faculty or room behind', async () => {
    const before = counts(sqlite, ['workspaces', 'course_components', 'faculty', 'venues', 'recurring_schedules']);
    await expect(WorkspaceRepository.buildCompleteWorkspace({
      name: 'Embedded Systems',
      components: [{
        type: 'theory', facultyName: 'Prof New', venueName: 'Room 9', durationMinutes: 60,
        sessions: [{ dayOfWeek: 1, startTime: '09:00', endTime: '10:00' }, { dayOfWeek: undefined as any, startTime: '11:00', endTime: '12:00' }],
      }],
    })).rejects.toThrow();
    expect(counts(sqlite, ['workspaces', 'course_components', 'faculty', 'venues', 'recurring_schedules'])).toEqual(before);
  });
});

describe('schedule changes never leave attendance wrong', () => {
  it('undoing "Thursday follows Friday" stops counting marks made on the borrowed classes', async () => {
    await DayRuleRepository.follow(THU, 5, { reason: 'Event' });
    await setOccurrenceStatus(await occ(THU, `rec_2_${THU}`), 'present'); // CN, borrowed from Friday
    expect((await att(2)).total).toBe(1);
    await DayRuleRepository.removeOn(THU);
    // CN has no class on Thursday any more, so nothing of CN's should count.
    expect((await att(2)).total).toBe(0);
    // And redoing the change brings the mark back.
    await DayRuleRepository.follow(THU, 5, { reason: 'Event' });
    expect(await att(2)).toMatchObject({ attended: 1, total: 1 });
  });

  it('Thursday and Friday can swap timetables', async () => {
    await DayRuleRepository.follow(THU, 5, { reason: 'Event' });
    await DayRuleRepository.follow(FRI, 4, { reason: 'Event' });
    const ids = (await CalendarService.getEffectiveSchedule(THU, FRI)).map((o: any) => `${o.date} ${o.id}`).sort();
    expect(ids).toEqual([`${THU} rec_2_${THU}`, `${THU} rec_3_${THU}`, `${FRI} rec_1_${FRI}`]);
  });

  it('a moved-in class is not counted when its new day becomes a day off, and comes back on undo', async () => {
    await ScheduleExceptionRepository.move(1, '2026-10-22', '13:00', '14:00', undefined, { targetDate: TUE, reason: 'Teacher swap' });
    await setOccurrenceStatus(await occ(TUE, 'rec_1_2026-10-22'), 'present');
    expect(await att(1)).toMatchObject({ attended: 1, total: 1 });
    await DayRuleRepository.dayOff(TUE, { reason: 'Holiday' });
    expect(await att(1)).toMatchObject({ attended: 0, total: 0 });
    await DayRuleRepository.removeOn(TUE);
    expect(await att(1)).toMatchObject({ attended: 1, total: 1 });
  });

  it('when the borrowed holiday is replaced, the follow rule stops claiming it is a holiday', async () => {
    const thu = await DayRuleRepository.follow(THU, 5, { reason: 'Event', borrowed: { date: FRI, mode: 'holiday' } });
    await DayRuleRepository.follow(FRI, 1, { reason: 'Exam' }); // Friday now runs Monday's timetable instead
    const after = await DayRuleRepository.forDate(THU);
    expect(after.id).toBe(thu.id);
    expect(after.borrowedMode).not.toBe('holiday');
  });

  it('refuses an extra class, or a move, onto a day off (it would silently vanish)', async () => {
    await DayRuleRepository.dayOff(TUE, { reason: 'Holiday' });
    await expect(ScheduleExceptionRepository.extra(1, TUE, '10:00', '11:00', { reason: 'Make-up class' })).rejects.toThrow(/day off/i);
    await expect(ScheduleExceptionRepository.move(1, '2026-10-22', '13:00', '14:00', undefined, { targetDate: TUE })).rejects.toThrow(/day off/i);
  });

  it('a class moved across the year boundary can be marked and counts once', async () => {
    await ScheduleExceptionRepository.move(1, '2026-12-31', '14:00', '15:00', undefined, { targetDate: '2027-01-01' });
    const o = await occ('2027-01-01', 'rec_1_2026-12-31');
    await setOccurrenceStatus(o, 'absent');
    expect((await CalendarService.getEffectiveSchedule('2026-12-31', '2026-12-31')).filter((x: any) => x.workspaceId === 1)).toHaveLength(0);
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM attendance WHERE occurrence_id = 'rec_1_2026-12-31'").get().n).toBe(1);
  });

  it('a leap day can follow another day', async () => {
    await DayRuleRepository.follow('2028-02-29', 5, { reason: 'Event' }); // a Tuesday running Friday
    const ids = (await CalendarService.getEffectiveSchedule('2028-02-29', '2028-02-29')).map((o: any) => o.id).sort();
    expect(ids).toEqual(['rec_2_2028-02-29', 'rec_3_2028-02-29']);
  });
});

describe('marking', () => {
  it('a double tap (two marks at once) keeps one record and does not error', async () => {
    const o = await occ('2026-10-22', 'rec_1_2026-10-22');
    await expect(Promise.all([setOccurrenceStatus(o, 'present'), setOccurrenceStatus(o, 'absent')])).resolves.toBeDefined();
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM attendance WHERE occurrence_id = 'rec_1_2026-10-22'").get().n).toBe(1);
  });

  it('cannot mark a class that is not on the timetable that day', async () => {
    await expect(setOccurrenceStatus({ id: 'rec_1_2026-10-23', workspaceId: 1, date: '2026-10-23', componentId: 1 }, 'present')).rejects.toThrow();
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM attendance').get().n).toBe(0);
  });
});

describe('findings from the earlier audits still hold', () => {
  it('P1-10/P5-05: the same teacher typed with extra spaces is reused, not duplicated', async () => {
    await WorkspaceRepository.buildCompleteWorkspace({
      name: 'Embedded Systems', components: [{ type: 'theory', facultyName: '  dr.  RD ', durationMinutes: 60, sessions: [{ dayOfWeek: 1, startTime: '09:00', endTime: '10:00' }] }],
    });
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM faculty').get().n).toBe(1);
  });

  it('two teachers with the same name (e.g. from an old backup) do not block creating a course', async () => {
    sqlite.exec("INSERT INTO faculty (id, name) VALUES (2, 'DR. RD')");
    const ws = await WorkspaceRepository.buildCompleteWorkspace({
      name: 'Embedded Systems', components: [{ type: 'theory', facultyName: 'Dr. RD', durationMinutes: 60, sessions: [{ dayOfWeek: 1, startTime: '09:00', endTime: '10:00' }] }],
    });
    // No third row, and the course uses the oldest of the two.
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM faculty').get().n).toBe(2);
    const used = sqlite.prepare(`SELECT DISTINCT faculty_id AS id FROM component_faculty_assignments
      WHERE component_id IN (SELECT id FROM course_components WHERE workspace_id = ?)`).all(ws.id);
    expect(used).toEqual([{ id: 1 }]);
  });

  it('P5-07: a task for a course that does not exist is refused and nothing is saved', async () => {
    await expect(TaskRepository.createTask({ workspaceId: 999, title: 'Ghost' })).rejects.toThrow();
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM tasks').get().n).toBe(1);
  });

  it('P6-07: a semester that still has courses cannot be deleted', async () => {
    await expect(SemesterRepository.deleteSemester(1)).rejects.toThrow();
    expect(counts(sqlite, ['semesters', 'workspaces'])).toEqual({ semesters: 1, workspaces: 2 });
  });

  it('P6 §10: activating a semester that does not exist changes nothing', async () => {
    await expect(SemesterRepository.activateSemester(42)).rejects.toThrow();
    expect(sqlite.prepare('SELECT id FROM semesters WHERE is_active = 1').all()).toEqual([{ id: 1 }]);
  });
});

// phase_b.test.ts had tests 3, 4, 5 and 7 that asserted on code written inside the
// test itself, so they could not fail. These check the same claims through the app.
describe('claims the old tautological tests made, checked through the real code', () => {
  const MON_BEFORE = '2026-08-03', MON_LAST_DAY_A = '2026-08-09', MON_FIRST_DAY_B = '2026-08-10';

  it('a teacher change applies from its date: the day before keeps the old teacher', async () => {
    const ws = await WorkspaceRepository.buildCompleteWorkspace({
      name: 'Embedded Systems', components: [{ type: 'theory', facultyName: 'Faculty A', durationMinutes: 60,
        sessions: [{ dayOfWeek: 1, startTime: '09:00', endTime: '10:00' }, { dayOfWeek: 0, startTime: '09:00', endTime: '10:00' }] }],
    });
    const comp = sqlite.prepare('SELECT id FROM course_components WHERE workspace_id = ?').get(ws.id).id;
    await WorkspaceRepository.changeHistoricalFaculty(comp, 'Faculty B', MON_FIRST_DAY_B);
    const teacherOn = async (d: string) => (await CalendarService.getEffectiveSchedule(d, d)).find((o: any) => o.workspaceId === ws.id)?.facultyName;
    expect(await teacherOn(MON_BEFORE)).toBe('Faculty A');
    expect(await teacherOn(MON_LAST_DAY_A)).toBe('Faculty A'); // a Sunday class, the last day of A
    expect(await teacherOn(MON_FIRST_DAY_B)).toBe('Faculty B');
    // The schedule falls back to the course's default teacher, so it cannot show a gap day.
    // The stored boundary can: A must end exactly the day before B starts, in any timezone.
    const rows = sqlite.prepare('SELECT effective_from AS f, effective_until AS u FROM component_faculty_assignments WHERE component_id = ? ORDER BY id').all(comp);
    expect(rows).toEqual([{ f: '2026-07-01', u: MON_LAST_DAY_A }, { f: MON_FIRST_DAY_B, u: null }]);
  });

  it('a moved class can change room; the other classes keep theirs', async () => {
    sqlite.exec("INSERT INTO venues (id, name) VALUES (5, 'Room 204'); INSERT INTO component_venue_assignments (component_id, venue_id, effective_from) VALUES (1, 5, '2026-07-01')");
    await ScheduleExceptionRepository.move(3, FRI, '12:00', '13:00', 'Seminar Hall');
    const fri = await CalendarService.getEffectiveSchedule(FRI, FRI);
    expect(fri.find((o: any) => o.id === `rec_3_${FRI}`).venueName).toBe('Seminar Hall');
    expect((await occ(THU, `rec_1_${THU}`)).venueName).toBe('Room 204');
  });

  it('cancelling one of two lectures of a course on the same day leaves the other', async () => {
    sqlite.exec("INSERT INTO recurring_schedules (id, component_id, day_of_week, start_time, end_time) VALUES (4, 1, 4, '14:00', '15:00')");
    await ScheduleExceptionRepository.cancel(4, THU, 'Teacher absent');
    const ids = (await CalendarService.getEffectiveSchedule(THU, THU)).map((o: any) => o.id);
    expect(ids).toEqual([`rec_1_${THU}`]);
    await setOccurrenceStatus(await occ(THU, `rec_1_${THU}`), 'present');
    expect(await att(1)).toMatchObject({ attended: 1, total: 1 });
  });
});
