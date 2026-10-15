/**
 * Property tests for the attendance maths (ordinance clause 9).
 * Reference values come from a brute-force simulation in exact integer arithmetic,
 * not from the formulas under test.
 */
import fc from 'fast-check';
import { canSkip, countAttendance, mustAttend, pctOf, projectChange, type AttStatus } from '../domains/academic/logic';

const meets = (a: number, t: number, target: number) => t === 0 || a * 100 >= target * t; // exact
const counts = fc.tuple(fc.integer({ min: 0, max: 400 }), fc.integer({ min: 0, max: 400 }), fc.integer({ min: 1, max: 99 }))
  .map(([a, extra, target]: number[]) => ({ a, t: a + extra, target }));

describe('pctOf never rounds toward safe', () => {
  it('equals the exact floor of 100·a/t', () => {
    fc.assert(fc.property(fc.integer({ min: 0, max: 100000 }), fc.integer({ min: 1, max: 100000 }), (a, extra) => {
      const t = a + extra;
      expect(pctOf(a, t)).toBe(Math.floor((a * 100 - ((a * 100) % t)) / t));
    }), { numRuns: 2000 });
  });
});

describe('canSkip and mustAttend agree with a class-by-class simulation', () => {
  it('canSkip(a,t) is the largest k with a/(t+k) still at target', () => {
    fc.assert(fc.property(counts, ({ a, t, target }) => {
      let k = 0;
      if (!meets(a, t, target)) k = 0; else while (meets(a, t + k + 1, target)) k++;
      expect(canSkip(a, t, target)).toBe(k);
    }), { numRuns: 1500 });
  });

  it('mustAttend(a,t) is the smallest n with (a+n)/(t+n) at target', () => {
    fc.assert(fc.property(counts, ({ a, t, target }) => {
      let n = 0;
      while (!meets(a + n, t + n, target)) n++;
      expect(mustAttend(a, t, target)).toBe(n);
    }), { numRuns: 1500 });
  });
});

describe('projectChange matches recounting the records', () => {
  const status = fc.constantFrom<AttStatus | null>('present', 'absent', 'exempt', 'cancelled', 'holiday', null);
  it('changing one mark gives the same % as counting again', () => {
    fc.assert(fc.property(fc.array(fc.constantFrom('present', 'absent', 'exempt', 'cancelled', 'holiday'), { maxLength: 60 }), status, status,
      (rest: string[], from: AttStatus | null, to: AttStatus | null) => {
        const before = countAttendance([...rest, ...(from ? [from] : [])].map((s) => ({ status: s })));
        const after = countAttendance([...rest, ...(to ? [to] : [])].map((s) => ({ status: s })));
        expect(projectChange(before, from, to)).toBe(after.pct);
      }), { numRuns: 1500 });
  });
});
