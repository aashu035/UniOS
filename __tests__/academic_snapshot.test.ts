import Database from 'better-sqlite3';
import path from 'path';
// @ts-ignore
import { drizzle } from 'drizzle-orm/better-sqlite3';
// @ts-ignore
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '../core/db/schema';

// Real schema from the migration chain, so the loader is tested against what ships.
const mockSqlite = new Database(':memory:');
mockSqlite.pragma('foreign_keys = OFF');
const mockDb = drizzle(mockSqlite, { schema });
migrate(mockDb, { migrationsFolder: path.join(__dirname, '../drizzle') });
mockSqlite.pragma('foreign_keys = ON');

jest.mock('../core/db/client', () => ({ db: mockDb, expoDb: {} }));

const { loadSnapshot, shortLabel, normalizeDate } = require('../domains/academic/snapshot');
const { buildAlerts, markQueue, suggestion } = require('../domains/academic/derive');

// Thursday 1 Oct 2026 (week 40), as in the design.
const TODAY = '2026-10-01';

beforeAll(() => {
  mockSqlite.exec(`
    INSERT INTO semesters (id, number, name, start_date, is_active) VALUES (1, 5, 'Sem 5', '2026-07-01', 1), (2, 4, 'Sem 4', '2026-01-01', 0);
    INSERT INTO workspaces (id, semester_id, name, color, target_attendance) VALUES
      (1, 1, 'Operating Systems', '#8B5CF6', 75), (2, 1, 'Computer Networks', '#EF4444', 75), (3, 2, 'Old Course', '#000000', 75);
    INSERT INTO course_components (id, workspace_id, type, duration_minutes) VALUES (1, 1, 'theory', 60), (2, 2, 'theory', 60), (3, 3, 'theory', 60);
    -- OS Thursdays 9-10, CN Thursdays 15-16, old course Thursdays 11-12
    INSERT INTO recurring_schedules (id, component_id, day_of_week, start_time, end_time) VALUES (1, 1, 4, '09:00', '10:00'), (2, 2, 4, '15:00', '16:00'), (3, 3, 4, '11:00', '12:00'), (4, 2, 5, '10:00', '11:00');
    -- CN moved to 16:00 today; CN cancelled tomorrow (Friday slot)
    INSERT INTO schedule_exceptions (component_id, recurring_schedule_id, specific_date, action, start_time, end_time) VALUES
      (2, 2, '2026-10-01', 'move', '16:00', '17:00'), (2, 4, '2026-10-02', 'cancel', NULL, NULL);
    INSERT INTO tasks (workspace_id, title, type, due_date, priority, status) VALUES
      (1, 'OS Assignment 2', 'assignment', '2026-10-02', 'high', 'pending'),
      (2, 'CN quiz', 'quiz', '2026-10-12', 'medium', 'pending'),
      (1, 'Done one', 'assignment', '2026-09-29', 'low', 'submitted'),
      (3, 'Old course task', 'assignment', '2026-10-01', 'low', 'pending');
  `);
  // OS: 24 of 33 attended over past Thursdays and other days.
  const ins = mockSqlite.prepare(`INSERT INTO attendance (component_id, occurrence_id, identity_status, date, status) VALUES (1, ?, 'resolved', ?, ?)`);
  for (let i = 0; i < 33; i++) ins.run(`legacy_${i}`, `2026-08-${String((i % 28) + 1).padStart(2, '0')}`, i < 24 ? 'present' : 'absent');
  ins.run('legacy_off', '2026-08-30', 'cancelled');
});

describe('academic snapshot', () => {
  it('scopes to the active semester and counts attendance', async () => {
    const s = await loadSnapshot({ today: TODAY });
    expect(s.courses.map((c: any) => c.name)).toEqual(['Operating Systems', 'Computer Networks']);
    const os = s.courseById.get(1);
    expect(os.short).toBe('OS');
    expect(os.att).toEqual({ attended: 24, absent: 9, leave: 0, off: 1, total: 33, pct: 72, pctWithLeave: 72 }); // 72.7% rounds down
    expect(s.tasks.map((t: any) => t.title)).not.toContain('Old course task');
    expect(os.parts).toEqual([{ type: 'theory', componentIds: [1], att: os.att }]);
    expect(s.semester).toMatchObject({ id: 1, startDate: '2026-07-01' });
  });

  it('keeps cancelled classes and the original slot of moved ones', async () => {
    const s = await loadSnapshot({ today: TODAY });
    const today = s.occurrences.filter((o: any) => o.date === TODAY);
    expect(today.map((o: any) => [o.workspaceName, o.startTime])).toEqual([['Operating Systems', '09:00'], ['Computer Networks', '16:00']]);
    expect(today[1].original).toEqual({ startTime: '15:00', endTime: '16:00' });
    const fri = s.occurrences.filter((o: any) => o.date === '2026-10-02');
    expect(fri).toHaveLength(1);
    expect(fri[0].cancelled).toBe(true);
  });

  it('builds the alert deck, suggestion and mark queue', async () => {
    const s = await loadSnapshot({ today: TODAY });
    const alerts = buildAlerts(s);
    expect(alerts.map((a: any) => a.key)).toEqual(['att-1', expect.stringMatching(/^task-/), expect.stringMatching(/^chg-/), expect.stringMatching(/^chg-/)]);
    expect(alerts[0].title).toBe('72%, below your 75% target');
    expect(alerts[0].body).toBe('Attend the next 3 OS classes to get back above target.');
    expect(alerts[1].eyebrow).toBe('Due tomorrow');
    expect(alerts[2].title).toBe('Computer Networks moved to 4:00 PM today');
    expect(alerts[3].title).toBe('Computer Networks cancelled tomorrow');

    expect(suggestion(s, 9 * 60 + 41)).toEqual({ text: 'OS ends in 19 min. Mark attendance?', route: '/attendance/mark' });
    expect(markQueue(s).map((o: any) => o.workspaceName)).toEqual(['Operating Systems', 'Computer Networks']);
  });

  it('marks through the repository and the snapshot sees it', async () => {
    const { AttendanceRepository } = require('../domains/attendance/repository');
    const s = await loadSnapshot({ today: TODAY });
    const os = s.occurrences.find((o: any) => o.date === TODAY && o.workspaceId === 1);
    await AttendanceRepository.markAttendance(1, TODAY, 'present', os.id, os.componentId);
    const after = await loadSnapshot({ today: TODAY });
    expect(after.courseById.get(1).att.pct).toBe(73); // 25/34 = 73.5
    expect(markQueue(after).map((o: any) => o.workspaceName)).toEqual(['Computer Networks']);
    expect(suggestion(after, 9 * 60 + 41)).toBeNull();
  });

  it('changes a mark to leave or off, then removes it', async () => {
    const { setOccurrenceStatus } = require('../domains/academic/actions');
    const s = await loadSnapshot({ today: TODAY });
    const os = s.occurrences.find((o: any) => o.date === TODAY && o.workspaceId === 1);
    const att = async () => (await loadSnapshot({ today: TODAY })).courseById.get(1).att;

    await setOccurrenceStatus(os, 'exempt'); // leave is held but not attended until approved
    expect(await att()).toMatchObject({ attended: 24, leave: 1, total: 34, pct: 70, pctWithLeave: 73 });

    await setOccurrenceStatus(os, 'cancelled'); // marked in advance, class didn't happen
    expect(await att()).toMatchObject({ attended: 24, total: 33, off: 2, pct: 72 });

    await setOccurrenceStatus(os, null); // remove the mark entirely
    const after = await loadSnapshot({ today: TODAY });
    expect(after.courseById.get(1).att).toMatchObject({ attended: 24, total: 33, off: 1 });
    expect(after.occurrences.find((o: any) => o.id === os.id).status).toBeNull();
    expect(markQueue(after).map((o: any) => o.workspaceName)).toContain('Operating Systems');

    await setOccurrenceStatus(os, 'present'); // restore for later tests
  });
});

describe('temporary changes', () => {
  const { ScheduleExceptionRepository, parseRecurringOccurrence } = require('../domains/calendar/exceptions');
  it('parses regular class ids', () => {
    expect(parseRecurringOccurrence('rec_12_2026-10-08')).toEqual({ recurringScheduleId: 12, date: '2026-10-08' });
    expect(parseRecurringOccurrence('ex_3')).toBeNull();
  });
  it('cancels, moves and restores one day of a class', async () => {
    const day = '2026-10-08'; // next Thursday, OS 9-10
    const os = () => loadSnapshot({ today: TODAY, from: day, to: day }).then((s: any) => s.occurrences.filter((o: any) => o.workspaceId === 1));

    await ScheduleExceptionRepository.cancel(1, day);
    expect((await os()).map((o: any) => [o.startTime, !!o.cancelled])).toEqual([['09:00', true]]);

    await ScheduleExceptionRepository.move(1, day, '11:00', '12:00', 'Seminar Hall');
    const moved = await os();
    expect(moved).toHaveLength(1);
    expect(moved[0]).toMatchObject({ startTime: '11:00', endTime: '12:00', venueName: 'Seminar Hall', exceptionAction: 'move', original: { startTime: '09:00', endTime: '10:00' } });

    await ScheduleExceptionRepository.restore(1, day);
    const back = await os();
    expect(back.map((o: any) => [o.startTime, o.isException])).toEqual([['09:00', false]]);

    await expect(ScheduleExceptionRepository.move(1, day, '12:00', '11:00')).rejects.toThrow('Pick a start time before the end time.');
  });

  it('cancelling a marked class makes the mark Off, and restoring brings it back', async () => {
    const { setOccurrenceStatus } = require('../domains/academic/actions');
    const day = '2026-10-15'; // a Thursday, OS 9-10
    const att = async () => (await loadSnapshot({ today: TODAY })).courseById.get(1).att;
    const before = await att();
    const [os] = (await loadSnapshot({ today: TODAY, from: day, to: day })).occurrences.filter((o: any) => o.workspaceId === 1);
    await setOccurrenceStatus(os, 'absent');
    expect((await att()).absent).toBe(before.absent + 1);

    await ScheduleExceptionRepository.cancel(1, day);
    expect(await att()).toMatchObject({ absent: before.absent, off: before.off + 1, total: before.total });

    await ScheduleExceptionRepository.restore(1, day);
    expect(await att()).toMatchObject({ absent: before.absent + 1, off: before.off });
    await setOccurrenceStatus(os, null);
  });

  it('an existing mark can be changed even when its slot is no longer on the timetable', async () => {
    const { setOccurrenceStatus } = require('../domains/academic/actions');
    const stale = { id: 'legacy_0', workspaceId: 1, date: '2026-08-01', componentId: 1 }; // seeded present, not a timetable slot
    await setOccurrenceStatus(stale, 'absent');
    const row = mockSqlite.prepare(`SELECT status FROM attendance WHERE occurrence_id = 'legacy_0'`).get() as any;
    expect(row.status).toBe('absent');
    await setOccurrenceStatus(stale, 'present');
    // A brand-new mark for a non-existent class still gets a readable error.
    await expect(setOccurrenceStatus({ id: 'rec_999_2026-10-01', workspaceId: 1, date: '2026-10-01', componentId: 1 }, 'present'))
      .rejects.toThrow("isn't on your timetable for that day anymore");
  });
});

describe('due date normalisation', () => {
  it('reduces stored dates to local YYYY-MM-DD', () => {
    expect(normalizeDate('2026-10-20')).toBe('2026-10-20');
    const iso = new Date(2026, 9, 20, 23, 59).toISOString();
    expect(normalizeDate(iso)).toBe('2026-10-20');
    expect(normalizeDate(String(new Date(2026, 9, 20, 9).getTime()))).toBe('2026-10-20');
    expect(normalizeDate('not a date')).toBeNull();
    expect(normalizeDate('2026-10-05 18:30:00')).toBe('2026-10-05'); // SQL datetime, no zone
    expect(normalizeDate('2026-10-05T18:30')).toBe('2026-10-05');
    expect(normalizeDate('05/10/2026')).toBe('2026-10-05'); // day first
    expect(normalizeDate('5.10.2026')).toBe('2026-10-05');
    expect(normalizeDate('2026-13-40')).toBeNull();
    expect(normalizeDate('1791200000')).toMatch(/^\d{4}-\d{2}-\d{2}$/); // unix seconds
    expect(normalizeDate(null)).toBeNull();
  });
  it('loads timestamp due dates without NaN', async () => {
    mockSqlite.exec(`INSERT INTO tasks (workspace_id, title, type, due_date, priority, status) VALUES (1, 'Timestamp task', 'lab', '${new Date(2026, 9, 5, 18, 30).toISOString()}', 'medium', 'pending')`);
    const s = await loadSnapshot({ today: TODAY });
    expect(s.tasks.find((t: any) => t.title === 'Timestamp task').dueDate).toBe('2026-10-05');
  });
});

describe('unreachable target', () => {
  it('alerts never say Infinity', async () => {
    mockSqlite.exec(`UPDATE workspaces SET target_attendance = 100 WHERE id = 1`);
    const s = await loadSnapshot({ today: TODAY });
    const a = buildAlerts(s).find((x: any) => x.key === 'att-1');
    expect(a.body).toBe("100% can't be reached anymore. Every class still counts.");
    expect(JSON.stringify(buildAlerts(s))).not.toMatch(/Infinity|NaN|undefined/);
    mockSqlite.exec(`UPDATE workspaces SET target_attendance = 75 WHERE id = 1`);
  });
});

describe('short labels', () => {
  it.each([
    ['Operating Systems', null, 'OS'], ['DBMS', null, 'DBMS'], ['Discrete Mathematics', null, 'DM'],
    ['Design and Analysis of Algorithms', null, 'DAA'], ['Mathematics', null, 'Math'], ['Anything', 'ANY', 'ANY'],
  ])('%s', (name, short, out) => { expect(shortLabel(name, short)).toBe(out); });
});

describe('attack: cancels, undo and double taps against the real schema', () => {
  const { setOccurrenceStatus } = require('../domains/academic/actions');
  const { ScheduleExceptionRepository } = require('../domains/calendar/exceptions');
  const day = '2026-10-22'; // Thursday, OS 9-10 (recurring schedule 1)
  const occ = { id: `rec_1_${day}`, workspaceId: 1, date: day, componentId: 1, componentType: 'theory' };
  const row = () => mockSqlite.prepare(`SELECT status, notes FROM attendance WHERE occurrence_id = ?`).get(occ.id) as any;

  afterEach(async () => {
    await ScheduleExceptionRepository.restore(1, day);
    mockSqlite.prepare(`DELETE FROM attendance WHERE occurrence_id = ?`).run(occ.id);
  });

  it('cancelling twice keeps the original mark recoverable', async () => {
    await setOccurrenceStatus(occ, 'absent');
    await ScheduleExceptionRepository.cancel(1, day);
    await ScheduleExceptionRepository.cancel(1, day);
    expect(row()).toEqual({ status: 'cancelled', notes: 'was:absent' });
    await ScheduleExceptionRepository.restore(1, day);
    expect(row()).toEqual({ status: 'absent', notes: null });
  });

  it("a mark the student changed after cancelling is not overwritten by restore", async () => {
    await setOccurrenceStatus(occ, 'absent');
    await ScheduleExceptionRepository.cancel(1, day);
    await setOccurrenceStatus(occ, 'present'); // class happened after all, marked by hand
    await ScheduleExceptionRepository.restore(1, day);
    expect(row().status).toBe('present');
  });

  it('undo after removing the Off mark of a cancelled class puts it back', async () => {
    await setOccurrenceStatus(occ, 'absent');
    await ScheduleExceptionRepository.cancel(1, day);
    await setOccurrenceStatus(occ, null); // Remove mark
    expect(row()).toBeUndefined();
    await setOccurrenceStatus(occ, 'cancelled', null); // Undo
    expect(row().status).toBe('cancelled');
  });

  it('two saves at the same moment leave exactly one mark', async () => {
    await Promise.all([setOccurrenceStatus(occ, 'present'), setOccurrenceStatus(occ, 'absent')]);
    const n = (mockSqlite.prepare(`SELECT COUNT(*) AS n FROM attendance WHERE occurrence_id = ?`).get(occ.id) as any).n;
    expect(n).toBe(1);
  });

  it('a class moved to another time keeps its mark and stays markable', async () => {
    await ScheduleExceptionRepository.move(1, day, '14:00', '15:00');
    await setOccurrenceStatus(occ, 'present');
    expect(row().status).toBe('present');
  });
});
