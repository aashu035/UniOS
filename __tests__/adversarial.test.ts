/**
 * Cases written to break the app, not to confirm it. Each one is a situation a
 * real student can hit; a failure here is a bug in the app, not in the test.
 */
import { canSkip, countAttendance, leaveNote, mustAttend, verdict } from '../domains/academic/logic';
import { normalizeDate } from '../domains/academic/snapshot';
import { parseCell, resolveTimetable, hourlyPeriods } from '../domains/timetable/grammar';
import { planImport, to24h } from '../domains/workspace/importPlan';
import { isModelUnavailable, friendlyGeminiError } from '../core/ai/geminiModels';

jest.mock('../core/db/client', () => ({ db: {}, expoDb: {} }));

const att = (p: number, a: number, l = 0) => countAttendance([
  ...Array(p).fill({ status: 'present' }), ...Array(a).fill({ status: 'absent' }), ...Array(l).fill({ status: 'exempt' }),
]);

describe('the 75% boundary must never be overstated (detention is decided on it)', () => {
  it('149 of 200 is 74.5%: below 75, so it must not show 75%', () => {
    const c = att(149, 51);
    expect(c.pct).toBeLessThan(75);
    expect(verdict(c.attended, c.total, 75).tone).toBe('danger');
    expect(leaveNote(c, 75)?.text ?? '').not.toMatch(/above 75%/);
  });
  it('2 of 3 shows 66%, not a rounded-up 67% (never round toward safety)', () => {
    expect(att(2, 1).pct).toBe(66);
  });
  it('leave that would only reach 74.9% is not called enough', () => {
    const c = att(140, 52, 7); // 140/199 = 70.35%, (140+7)/199 = 73.9%
    expect(leaveNote(c, 75)?.text).not.toMatch(/only if your/);
  });
  it('skip and must-attend agree with each other at every size', () => {
    for (let t = 1; t <= 120; t++) for (let a = 0; a <= t; a++) {
      const s = canSkip(a, t, 75), n = mustAttend(a, t, 75);
      expect(s > 0 && n > 0).toBe(false);
      if (s > 0) expect(a / (t + s)).toBeGreaterThanOrEqual(0.75);
    }
  });
});

describe('dates that do not exist must not be accepted', () => {
  it.each(['2026-02-30', '2026-04-31', '31/04/2026', '29/02/2027', '2026-00-10', '2026-13-01'])('%s', (d) => {
    expect(normalizeDate(d)).toBeNull();
  });
  it('accepts a real leap day', () => { expect(normalizeDate('29/02/2028')).toBe('2028-02-29'); });
});

describe('timetable cells as OCR or a tired student would type them', () => {
  const ctx = { courses: new Set(['SC', 'CN', 'PP', 'ES', 'FLA', 'CS', 'OE']), groupPrefix: 'CSE' };
  it('reads a group written with a space after the dash ("CSE- 2")', () => {
    expect(parseCell('P3, SC Lab, CSE- 2, RS Lab, AS', ctx).groups).toEqual(['CSE-2']);
  });
  it('reads a group written without a dash ("CSE2")', () => {
    expect(parseCell('SC Lab, CSE2', ctx).groups).toEqual(['CSE-2']);
  });
  it('reads a cell shared by two groups ("CSE-1, 2" and "CSE-1 & CSE-2")', () => {
    expect(parseCell('PP Lab, CSE-1, 2, CVR-208', ctx).groups).toEqual(['CSE-1', 'CSE-2']);
    expect(parseCell('PP Lab, CSE-1 & CSE-2, CVR-208', ctx).groups).toEqual(['CSE-1', 'CSE-2']);
  });
  it('reads lowercase OCR text', () => {
    expect(parseCell('sc lab, cse-2, rs lab, as', ctx)).toMatchObject({ course: 'SC', type: 'lab', groups: ['CSE-2'], venue: 'RS Lab' });
  });
  it('a venue split by OCR ("JCB 213") is still the venue, not faculty', () => {
    expect(parseCell('ES-L JCB 213', ctx)).toMatchObject({ venue: 'JCB-213', faculty: [] });
  });
  it('a cell beyond the last period is flagged, never silently dropped', () => {
    const r = resolveTimetable([{ day: 3, fromPeriod: 10, toPeriod: 11, text: 'PP Lab, CSE-2' }], { periods: hourlyPeriods(8, 10), group: 'CSE-2' });
    expect(r).toHaveLength(1);
    expect(r[0].doubt).toMatch(/period/i);
  });
});

describe('AI import times as printed on Indian timetables', () => {
  it('"1:00-1:55" with no AM/PM in a college day means afternoon', () => {
    const { courses, warnings } = planImport([{ day: 'Monday', startTime: '1:00', endTime: '1:55', subjectCode: 'FLA', type: 'tutorial' },
      { day: 'Monday', startTime: '9:00', endTime: '9:55', subjectCode: 'FLA', type: 'theory' }]);
    expect(warnings).toEqual([]);
    expect(courses[0].components.find((c) => c.type === 'tutorial')!.sessions).toEqual([{ dayOfWeek: 1, startTime: '13:00', endTime: '13:55' }]);
  });
  it('"12:00-1:55" lab crossing noon without AM/PM', () => {
    const { courses } = planImport([{ day: 'Tuesday', startTime: '12:00', endTime: '1:55', subjectCode: 'ES', type: 'lab' }]);
    expect(courses[0].components.find((c) => c.type === 'lab')!.sessions).toEqual([{ dayOfWeek: 2, startTime: '12:00', endTime: '13:55' }]);
  });
  it('rejects nonsense instead of inventing a time', () => {
    expect([to24h('25:00'), to24h('9:75'), to24h('00:00 PM')]).toEqual([null, null, null]);
  });
});

describe('Gemini errors that are not about the model', () => {
  it('a quota error mentioning a model name is not treated as "model gone"', () => {
    const e = Object.assign(new Error('Quota exceeded for metric generate_content_free_tier_requests, model: gemini-flash-latest'), { status: 429 });
    expect(isModelUnavailable(e)).toBe(false);
    expect(friendlyGeminiError(e)).toMatch(/quota/);
  });
  it('an error with no message at all still gives advice', () => {
    expect(friendlyGeminiError({})).not.toBe('');
    expect(friendlyGeminiError(undefined)).toMatch(/try again/i);
  });
});

describe('"You\'d be at" must equal a real recount, for every change', () => {
  const { projectChange } = require('../domains/academic/logic');
  const S = ['present', 'absent', 'exempt', 'cancelled', 'holiday', null] as const;
  it('matches recounting the marks after the change (random semesters)', () => {
    let seed = 7;
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
    for (let run = 0; run < 400; run++) {
      const marks = Array.from({ length: 1 + Math.floor(rnd() * 60) }, () => S[Math.floor(rnd() * S.length)]);
      const i = Math.floor(rnd() * marks.length);
      const to = S[Math.floor(rnd() * S.length)];
      const before = countAttendance(marks.filter(Boolean).map((status) => ({ status: status! })));
      const after = marks.slice(); after[i] = to;
      const real = countAttendance(after.filter(Boolean).map((status) => ({ status: status! })));
      expect(projectChange(before, marks[i], to)).toBe(real.pct);
    }
  });
});
