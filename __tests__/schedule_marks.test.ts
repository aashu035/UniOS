/**
 * Marks and schedule changes (audit 2026-10-14, SEC-01 and SEC-06).
 * Rule: a mark counts if and only if its class runs on the effective schedule.
 * Runs on the device driver (testing/expoSqliteHarness.ts), so transactions are real.
 */
import fc from 'fast-check';
import { createDeviceDb } from '../testing/expoSqliteHarness';

const mockDevice: { db?: any; expoDb?: any } = {};
jest.mock('../core/db/client', () => ({
  get db() { return mockDevice.db; },
  get expoDb() { return mockDevice.expoDb; },
}));

const { DayRuleRepository } = require('../domains/calendar/dayRules');
const { ScheduleExceptionRepository } = require('../domains/calendar/exceptions');
const { CalendarService } = require('../domains/calendar/service');
const { reconcileAllMarks } = require('../domains/calendar/marks');
const { atomic } = require('../core/db/atomic');
const { setOccurrenceStatus } = require('../domains/academic/actions');
const { loadSnapshot } = require('../domains/academic/snapshot');

const THU = '2026-10-29', FRI = '2026-10-30', NEXT_THU = '2026-11-05';
let sqlite: any;

// OS: Thu 09-10 (slot 1), Fri 12-13 (slot 3). CN: Fri 10-11 (slot 2), Thu 11-12 (slot 4).
function seed() {
  const h = createDeviceDb();
  mockDevice.db = h.db; mockDevice.expoDb = h.expoDb; sqlite = h.sqlite;
  sqlite.exec(`
    INSERT INTO semesters (id, number, name, start_date, is_active) VALUES (1, 5, 'Sem 5', '2026-07-01', 1);
    INSERT INTO workspaces (id, semester_id, name, color, target_attendance) VALUES (1, 1, 'OS', '#000', 75), (2, 1, 'CN', '#000', 75);
    INSERT INTO course_components (id, workspace_id, type, duration_minutes) VALUES (1, 1, 'theory', 60), (2, 2, 'theory', 60);
    INSERT INTO recurring_schedules (id, component_id, day_of_week, start_time, end_time) VALUES
      (1, 1, 4, '09:00', '10:00'), (2, 2, 5, '10:00', '11:00'), (3, 1, 5, '12:00', '13:00'), (4, 2, 4, '11:00', '12:00');
  `);
}
const occ = async (date: string, id: string) => (await CalendarService.getEffectiveSchedule(date, date)).find((o: any) => o.id === id);
const att = async (course: number) => (await loadSnapshot({ today: '2026-11-10', from: '2026-10-01', to: '2026-11-30' })).courseById.get(course).att;
const marks = () => sqlite.prepare('SELECT occurrence_id AS id, status, notes FROM attendance ORDER BY occurrence_id').all();

/** Every mark that counts belongs to a class that runs, and every shadowed mark to one that does not. */
async function expectMarksMatchSchedule() {
  const running = new Set((await CalendarService.getEffectiveSchedule('2026-10-20', '2026-11-15')).map((o: any) => o.id));
  for (const m of marks()) {
    const counts = ['present', 'absent', 'exempt'].includes(m.status);
    const shadowed = /^was:/.test(m.notes ?? '');
    if (counts) expect({ id: m.id, runs: running.has(m.id) }).toEqual({ id: m.id, runs: true });
    if (shadowed) expect({ id: m.id, runs: running.has(m.id) }).toEqual({ id: m.id, runs: false });
  }
}

beforeEach(seed);

describe('undo never counts a class that did not run', () => {
  it('follow, mark the borrowed class, day off, undo: the borrowed mark stays Off', async () => {
    await DayRuleRepository.follow(THU, 5, { reason: 'Event' });
    await setOccurrenceStatus(await occ(THU, `rec_2_${THU}`), 'present');
    await DayRuleRepository.dayOff(THU, { reason: 'Holiday' });
    await DayRuleRepository.removeOn(THU);
    expect(await att(2)).toMatchObject({ attended: 0, total: 0 });
    await expectMarksMatchSchedule();
  });

  it('cancel, day off, undo the cancel only: the class stays Off while the day is off', async () => {
    await setOccurrenceStatus(await occ(THU, `rec_4_${THU}`), 'absent');
    await ScheduleExceptionRepository.cancel(4, THU, 'Teacher absent');
    await DayRuleRepository.dayOff(THU, { reason: 'Holiday' });
    await ScheduleExceptionRepository.restore(4, THU);
    expect(await att(2)).toMatchObject({ absent: 0, total: 0 });
    await DayRuleRepository.removeOn(THU); // now the day is normal again: the absence counts
    expect(await att(2)).toMatchObject({ absent: 1, total: 1 });
  });

  it('a class moved to a day that later becomes a day off stops counting, and counts again on undo', async () => {
    await setOccurrenceStatus(await occ(THU, `rec_1_${THU}`), 'present');
    await ScheduleExceptionRepository.move(1, THU, '14:00', '15:00', undefined, { targetDate: NEXT_THU });
    await DayRuleRepository.dayOff(NEXT_THU, { reason: 'Holiday' });
    expect(await att(1)).toMatchObject({ attended: 0, total: 0 });
    await DayRuleRepository.removeOn(NEXT_THU);
    expect(await att(1)).toMatchObject({ attended: 1, total: 1 });
    await expectMarksMatchSchedule();
  });

  it('redoing a follow brings back the marks made on its borrowed classes', async () => {
    await DayRuleRepository.follow(THU, 5, { reason: 'Event' });
    await setOccurrenceStatus(await occ(THU, `rec_2_${THU}`), 'present');
    await DayRuleRepository.removeOn(THU);
    expect(await att(2)).toMatchObject({ attended: 0 });
    await DayRuleRepository.follow(THU, 5, { reason: 'Event' });
    expect(await att(2)).toMatchObject({ attended: 1, total: 1 });
  });
});

describe('a change and its marks are saved together', () => {
  it('a day off that fails to save leaves the marks as they were', async () => {
    await setOccurrenceStatus(await occ(THU, `rec_1_${THU}`), 'present');
    const before = marks();
    sqlite.pragma(`max_page_count = ${sqlite.pragma('page_count', { simple: true })}`); // storage full
    await expect(DayRuleRepository.dayOff(THU, { reason: 'Holiday', note: 'x'.repeat(20000) })).rejects.toThrow();
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM day_rules').get()).toEqual({ n: 0 });
    expect(marks()).toEqual(before);
  });
});

describe('startup check heals data saved by older versions', () => {
  it('a mark counting on a day off is shadowed, and a mark left Off on a normal day comes back', async () => {
    sqlite.exec(`
      INSERT INTO day_rules (date, kind, reason, created_at) VALUES ('${THU}', 'off', 'Holiday', '2026-10-01');
      INSERT INTO attendance (component_id, occurrence_id, date, status, marked_at) VALUES (1, 'rec_1_${THU}', '${THU}', 'present', '2026-10-29T10:00:00Z');
      INSERT INTO attendance (component_id, occurrence_id, date, status, notes, marked_at) VALUES (1, 'rec_3_${FRI}', '${FRI}', 'cancelled', 'was:absent', '2026-10-30T10:00:00Z');
    `);
    atomic((tx: any) => reconcileAllMarks(tx));
    expect(marks()).toEqual([
      { id: `rec_1_${THU}`, status: 'cancelled', notes: 'was:present' },
      { id: `rec_3_${FRI}`, status: 'absent', notes: null },
    ]);
  });
});

type Op = 'followFri' | 'followMon' | 'followFriHoliday' | 'offThu' | 'offFri' | 'undoThu' | 'undoFri'
  | 'cancel1' | 'restore1' | 'cancel4' | 'restore4' | 'move1Fri' | 'markBorrowed' | 'markOwn';
const OPS: Op[] = ['followFri', 'followMon', 'followFriHoliday', 'offThu', 'offFri', 'undoThu', 'undoFri', 'cancel1', 'restore1', 'cancel4', 'restore4', 'move1Fri', 'markBorrowed', 'markOwn'];

async function apply(k: Op) {
  switch (k) {
    case 'followFri': return DayRuleRepository.follow(THU, 5, { reason: 'Event' });
    case 'followMon': return DayRuleRepository.follow(THU, 1, { reason: 'Event' });
    case 'followFriHoliday': return DayRuleRepository.follow(THU, 5, { reason: 'Event', borrowed: { date: FRI, mode: 'holiday' } });
    case 'offThu': return DayRuleRepository.dayOff(THU, { reason: 'Holiday' });
    case 'offFri': return DayRuleRepository.dayOff(FRI, { reason: 'Holiday' });
    case 'undoThu': return DayRuleRepository.removeOn(THU);
    case 'undoFri': return DayRuleRepository.removeOn(FRI);
    case 'cancel1': return ScheduleExceptionRepository.cancel(1, THU, 'Teacher absent');
    case 'restore1': return ScheduleExceptionRepository.restore(1, THU);
    case 'cancel4': return ScheduleExceptionRepository.cancel(4, THU, 'Teacher absent');
    case 'restore4': return ScheduleExceptionRepository.restore(4, THU);
    case 'move1Fri': return ScheduleExceptionRepository.move(1, THU, '15:00', '16:00', undefined, { targetDate: FRI });
    case 'markBorrowed': { const o = await occ(THU, `rec_2_${THU}`); if (o) await setOccurrenceStatus(o, 'present'); return; }
    case 'markOwn': { const o = await occ(FRI, `rec_3_${FRI}`); if (o) await setOccurrenceStatus(o, 'absent'); return; }
  }
}

describe('any sequence of changes', () => {
  it('keeps marks matching the schedule after every step, and undoing everything restores the original marks', async () => {
    await fc.assert(fc.asyncProperty(fc.array(fc.constantFrom(...OPS), { minLength: 1, maxLength: 8 }), async (ops: Op[]) => {
      seed();
      await setOccurrenceStatus(await occ(THU, `rec_1_${THU}`), 'present');
      await setOccurrenceStatus(await occ(THU, `rec_4_${THU}`), 'absent');
      for (const k of ops) {
        try { await apply(k); } catch { /* refused changes are allowed */ }
        await expectMarksMatchSchedule();
      }
      for (const k of ['undoThu', 'undoFri', 'restore1', 'restore4'] as const) await apply(k);
      const own = marks().filter((m: any) => m.id === `rec_1_${THU}` || m.id === `rec_4_${THU}`);
      expect(own).toEqual([{ id: `rec_1_${THU}`, status: 'present', notes: null }, { id: `rec_4_${THU}`, status: 'absent', notes: null }]);
      expect(await att(1)).toMatchObject({ attended: 1 });
      expect(await att(2)).toMatchObject({ absent: 1 });
    }), {
      numRuns: 150,
      // Counterexamples found by the audit; always tried first.
      examples: [[['followFri', 'markBorrowed', 'offThu', 'restore4']], [['followFri', 'markBorrowed', 'offThu', 'cancel1']]],
    });
  });
});
