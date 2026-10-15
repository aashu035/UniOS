/**
 * Gemini output is untrusted (audit 2026-10-14, SEC-04; OWASP LLM05). A prompt-injected
 * or confused model can break the requested schema. Bad rows are skipped with a warning;
 * good rows still import; nothing throws.
 */
import fc from 'fast-check';
import { planImport } from '../domains/workspace/importPlan';

const ok = { day: 'Monday', startTime: '09:00 AM', endTime: '09:55 AM', subjectCode: 'CN', type: 'theory' };
const slots = (r: ReturnType<typeof planImport>) => r.courses.flatMap((c) => c.components.flatMap((p) => p.sessions));

it.each(['constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf'])('day %p is not a weekday', (day) => {
  const r = planImport([{ ...ok, day }]);
  expect(slots(r)).toEqual([]);
  expect(r.warnings.join(' ')).toMatch(/unreadable slot/);
});

it.each([
  ['subjectCode is a number', { ...ok, subjectCode: 42 }],
  ['day is a number', { ...ok, day: 1 }],
  ['times are objects', { ...ok, startTime: {}, endTime: [] }],
  ['venue is an object', { ...ok, venue: { evil: true } }],
  ['row is a string', 'Monday 9 AM CN'],
  ['row is null', null],
])('%s: the bad row is skipped and the good row still imports', (_n, bad) => {
  const r = planImport([bad, { ...ok, subjectCode: 'OS' }]);
  expect(r.courses.map((c) => c.code)).toContain('OS');
  expect(slots(r).every((s) => Number.isInteger(s.dayOfWeek) && s.dayOfWeek >= 0 && s.dayOfWeek <= 6)).toBe(true);
});

it('output that is not a list gives a warning, not a crash', () => {
  expect(planImport({ classes: [ok] })).toEqual({ courses: [], warnings: ["The scan didn't return a list of classes."] });
  expect(planImport('nope').courses).toEqual([]);
});

it('never throws and never yields a slot outside the week, whatever the model returns', () => {
  fc.assert(fc.property(fc.array(fc.anything()), (rows: unknown[]) => {
    const r = planImport(rows);
    for (const s of slots(r)) {
      expect(Number.isInteger(s.dayOfWeek) && s.dayOfWeek >= 0 && s.dayOfWeek <= 6).toBe(true);
      expect(s.startTime < s.endTime).toBe(true);
    }
  }), { numRuns: 500 });
});
