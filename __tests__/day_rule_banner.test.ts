import { dayRuleBanner } from '../domains/academic/derive';
import type { DayRuleInfo } from '../domains/academic/snapshot';

const rule = (r: Partial<DayRuleInfo>): DayRuleInfo => ({
  id: 1, date: '2026-10-29', kind: 'follow', followsWeekday: 5, reason: 'Event', note: null,
  borrowedDate: null, borrowedMode: null, linkedRuleId: null, ...r,
});

describe('dayRuleBanner', () => {
  const thuFollowsFri = [rule({})];

  it('shows today all day, including early morning', () => {
    const b = dayRuleBanner({ today: '2026-10-29', dayRules: thuFollowsFri }, 0);
    expect(b?.when).toBe('today');
    expect(b?.title).toBe("Today follows Friday's timetable");
    expect(b?.body).toContain("Thursday's own classes don't count");
  });

  it('shows tomorrow only from 6 PM the evening before', () => {
    expect(dayRuleBanner({ today: '2026-10-28', dayRules: thuFollowsFri }, 17 * 60 + 59)).toBeNull();
    const b = dayRuleBanner({ today: '2026-10-28', dayRules: thuFollowsFri }, 18 * 60);
    expect(b?.when).toBe('tomorrow');
    expect(b?.title).toBe("Tomorrow follows Friday's timetable");
  });

  it("prefers today's rule over tomorrow's in the evening", () => {
    const rules = [rule({ id: 1, date: '2026-10-29' }), rule({ id: 2, date: '2026-10-30', kind: 'off', followsWeekday: null, reason: 'Holiday' })];
    expect(dayRuleBanner({ today: '2026-10-29', dayRules: rules }, 20 * 60)?.date).toBe('2026-10-29');
  });

  it('describes a day off with its reason', () => {
    const b = dayRuleBanner({ today: '2026-10-30', dayRules: [rule({ date: '2026-10-30', kind: 'off', followsWeekday: null, reason: 'Holiday' })] }, 600);
    expect(b).toEqual({ date: '2026-10-30', when: 'today', title: 'Today is off', body: 'No classes count · Holiday.' });
  });

  it('ignores rules two or more days away and works with none', () => {
    expect(dayRuleBanner({ today: '2026-10-27', dayRules: thuFollowsFri }, 23 * 60)).toBeNull();
    expect(dayRuleBanner({ today: '2026-10-27', dayRules: [] }, 600)).toBeNull();
  });
});
