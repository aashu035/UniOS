import { planImport, to24h } from '../domains/workspace/importPlan';

const S = (day: string, startTime: string, endTime: string, subjectCode: string, type: 'theory' | 'lab' | 'tutorial', venue?: string, faculty?: string) =>
  ({ day, startTime, endTime, subjectCode, type, venue, faculty });

describe('AI timetable import plan', () => {
  it('converts the 12-hour times the scan returns', () => {
    expect([to24h('08:00 AM'), to24h('12:00 PM'), to24h('01:00 PM'), to24h('12:30 am'), to24h('5:55pm'), to24h('13:00')]).toEqual(['08:00', '12:00', '13:00', '00:30', '17:55', '13:00']);
    expect([to24h('13:00 PM'), to24h('noon'), to24h('')]).toEqual([null, null, null]);
  });

  it('keeps every weekly slot and both parts of a course (it used to keep only the first)', () => {
    const { courses, warnings } = planImport([
      S('Monday', '10:00 AM', '10:55 AM', 'cn', 'theory', 'JCB-213', 'VF-5'),
      S('Thursday', '12:00 PM', '12:55 PM', 'CN', 'theory', 'JCB-213', 'VF-5'),
      S('Friday', '09:00 AM', '09:55 AM', 'CN', 'theory', 'JCB-213', 'VF-5'),
      S('Wednesday', '03:00 PM', '04:55 PM', 'CN', 'lab', 'CVR-210A', 'VF-5'),
      S('Monday', '10:00 AM', '10:55 AM', 'CN', 'theory'), // duplicate from a split cell
    ]);
    expect(warnings).toEqual([]);
    expect(courses).toEqual([{
      code: 'CN', credits: 4,
      components: [
        { type: 'theory', durationMinutes: 60, venueName: 'JCB-213', facultyName: 'VF-5', sessions: [
          { dayOfWeek: 1, startTime: '10:00', endTime: '10:55' }, { dayOfWeek: 4, startTime: '12:00', endTime: '12:55' }, { dayOfWeek: 5, startTime: '09:00', endTime: '09:55' }] },
        { type: 'lab', durationMinutes: 120, venueName: 'CVR-210A', facultyName: 'VF-5', sessions: [{ dayOfWeek: 3, startTime: '15:00', endTime: '16:55' }] },
      ],
    }]);
  });

  it('explains what it could not import instead of failing the whole scan', () => {
    const { courses, warnings } = planImport([
      S('Tuesday', '11:00 AM', '12:55 PM', 'XL', 'lab'),
      S('Funday', '09:00 AM', '09:55 AM', 'XL', 'theory'),
      S('Monday', '01:00 PM', '01:55 PM', 'FLA', 'tutorial'), S('Monday', '02:00 PM', '03:55 PM', 'FLA', 'lab'), S('Tuesday', '09:00 AM', '09:55 AM', 'FLA', 'theory'),
    ]);
    expect(courses.map((c) => [c.code, c.components.map((x) => x.type)])).toEqual([['XL', ['theory', 'lab']], ['FLA', ['theory', 'lab']]]);
    expect(warnings.join(' ')).toMatch(/XL: skipped an unreadable slot \(Funday/);
    expect(warnings.join(' ')).toMatch(/FLA: has both a lab and a tutorial/);
  });
});
