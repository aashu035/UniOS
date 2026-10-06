import { hourlyPeriods, parseCell, parseLegend, resolveTimetable, type CellText } from '../domains/timetable/grammar';

/**
 * B.Tech 5th Semester, Section A (July–Dec 2026), DCRUST: transcribed cell by cell
 * from the printed timetable. Split slots are one entry per printed line.
 * Days 1–5 = Mon–Fri, periods 1–10 = 8:00–8:55 … 5:00–5:55.
 */
const C = (day: number, from: number, to: number, text: string): CellText => ({ day, fromPeriod: from, toPeriod: to, text });
const SECTION_A: CellText[] = [
  // MON
  C(1, 2, 2, 'E1 ES-L JCB-213'), C(1, 3, 3, 'E2 CN-L JCB-213 VF-5'),
  C(1, 4, 5, 'P4, PP Lab, CSE-1, CVR-208, NV'), C(1, 4, 5, 'P4, ES Lab, CSE-3'), C(1, 4, 5, 'P4,'),
  C(1, 6, 6, 'E8 FLA-T, CSE-2, JCB-213, VF-3'), C(1, 7, 7, 'E7 CS-L JCB-213 VF-3'),
  C(1, 8, 9, 'P5, PP Lab, CSE-2, CVR-208, KR'), C(1, 8, 8, 'OE-T, CSE-1 JCB-214'), C(1, 9, 9, 'P5,'), C(1, 8, 9, 'P5,'),
  // TUE
  C(2, 1, 1, 'E9,'), C(2, 1, 1, 'E9,'), C(2, 1, 1, 'E9,'),
  C(2, 2, 2, 'E3 FLA-L JCB-213 NV'), C(2, 3, 3, 'E4 SC-L JCB-213 AS'),
  C(2, 4, 5, 'P7, ES Lab, CSE-2'), C(2, 4, 5, 'P7, SC Lab, CSE-3, RS Lab, AS'), C(2, 4, 5, 'P7,'),
  C(2, 6, 6, 'E6 CS-T, CSE-1, JCB-213, VF-3'), C(2, 7, 7, 'E5 OE-L JCB-213'),
  C(2, 8, 9, 'P2, PP Lab, CSE-1, CVR-208, NV'), C(2, 8, 9, 'P2, CN Lab, CSE-3, MT Lab, VF-5'), C(2, 8, 9, 'P2,'),
  // WED
  C(3, 1, 1, 'E9,'), C(3, 1, 1, 'E9,'), C(3, 1, 1, 'E9,'),
  C(3, 2, 2, 'E4 SC-L JCB-213 AS'), C(3, 3, 3, 'E3 FLA-L JCB-213 NV'), C(3, 4, 4, 'E7 CS-L JCB-213 VF-3'), C(3, 5, 5, 'E8 FLA-T CSE-3 JCB-213 VF-8'),
  C(3, 6, 7, 'P1, PP Lab, CSE-2, CVR-208, KR'), C(3, 6, 7, 'P1, SC Lab, CSE-1, RS Lab, AS'), C(3, 6, 7, 'P1,'),
  C(3, 8, 9, 'P6, PP Lab, CSE-3, CVR-208, VF-4'), C(3, 8, 9, 'P6, CN Lab, CSE-2, CVR-210A, VF-5'), C(3, 8, 8, 'P6,'), C(3, 9, 9, 'FLA-T, CSE-1, JCB-214, VF-8'),
  C(3, 10, 10, 'PP-L JCB-213 VF-4'),
  // THU
  C(4, 1, 1, 'E9,'), C(4, 1, 1, 'E9,'), C(4, 1, 1, 'E9,'),
  C(4, 2, 2, 'E7 PP-L JCB213 VF-4'), C(4, 3, 3, 'E8 CS-L JCB-213 VF-3'), C(4, 4, 4, 'E1 ES-L JCB-213'), C(4, 5, 5, 'E2 CN-L JCB-213 VF-5'),
  C(4, 6, 6, 'E6'), C(4, 7, 7, 'E5 OE-L JCB-213'),
  C(4, 8, 9, 'P3, ES Lab, CSE-1'), C(4, 8, 9, 'P3, SC Lab, CSE-2, RS Lab, AS'), C(4, 8, 8, 'CS-T, CSE-3, CVR-215B, VF-3'), C(4, 9, 9, 'OE-T, CSE-3, CVR-215B'),
  C(4, 10, 10, 'E10,'), C(4, 10, 10, 'E10,'), C(4, 10, 10, 'E10,'),
  // FRI
  C(5, 2, 2, 'E2 CN-L JCB-213 VF-5'), C(5, 3, 3, 'E1 ES-L JCB-213'), C(5, 4, 4, 'E5 OE-L JCB-213'), C(5, 5, 5, 'E6'),
  C(5, 6, 6, 'E3 FLA-L JCB-213 NV'), C(5, 7, 7, 'E4 SC-L JCB-213 AS'),
  C(5, 8, 9, 'P8, PP Lab, CSE-3, CVR-208, VF-4'), C(5, 8, 9, 'P8, CN Lab, CSE-1, CVR-210A, VF-5'), C(5, 8, 8, 'CS-T, CSE-2, JCB-213, VF-3'), C(5, 9, 9, 'OE-T, CSE-2, JCB-213'),
  C(5, 10, 10, 'E10,'), C(5, 10, 10, 'E10,'), C(5, 10, 10, 'E10,'),
];
const LEGEND_TEXT = `ES – Embedded Systems (ESECE301D)    FLA – Formal Languages and Automata Theory (PCCSE301D)    CS – Cyber Security    CN – Computer Networks (PCCSE305D)
PP – Python Programming (PCCSE307D)    SC – Soft Computing Techniques (PCAML303D)    OE – Industrial Safety`;
const periods = hourlyPeriods(8, 10);
const legend = parseLegend(LEGEND_TEXT);
const week = (group: string) => resolveTimetable(SECTION_A, { periods, group, legend })
  .map((c) => `${'_MTWRF'[c.day]} ${c.start}-${c.end} ${c.course} ${c.type}`);

describe('DCRUST timetable grammar', () => {
  it('reads the legend under the grid', () => {
    expect(legend.map((c) => c.abbr)).toEqual(['ES', 'FLA', 'CS', 'CN', 'PP', 'SC', 'OE']);
    expect(legend.find((c) => c.abbr === 'SC')).toEqual({ abbr: 'SC', name: 'Soft Computing Techniques', code: 'PCAML303D' });
    expect(legend.find((c) => c.abbr === 'CS')).toEqual({ abbr: 'CS', name: 'Cyber Security' });
  });

  it('splits a cell into course, type, group, venue and faculty', () => {
    const ctx = { courses: new Set(legend.map((c) => c.abbr)), groupPrefix: 'CSE' };
    expect(parseCell('P7, SC Lab, CSE-3, RS Lab, AS', ctx)).toEqual({ course: 'SC', type: 'lab', groups: ['CSE-3'], venue: 'RS Lab', faculty: ['AS'], unknown: [] });
    expect(parseCell('E8 FLA-T, CSE-2, JCB-213, VF-3', ctx)).toEqual({ course: 'FLA', type: 'tutorial', groups: ['CSE-2'], venue: 'JCB-213', faculty: ['VF-3'], unknown: [] });
    expect(parseCell('E7 PP-L JCB213 VF-4', ctx)).toMatchObject({ course: 'PP', type: 'theory', groups: [], venue: 'JCB-213', faculty: ['VF-4'] });
    expect(parseCell('P4,', ctx)).toMatchObject({ course: null, type: null });
    expect(parseCell('E9,', ctx)).toMatchObject({ course: null, unknown: [] });
  });

  it('gives CSE-2 exactly their week', () => {
    expect(week('CSE-2')).toEqual([
      'M 09:00-09:55 ES theory', 'M 10:00-10:55 CN theory', 'M 13:00-13:55 FLA tutorial', 'M 14:00-14:55 CS theory', 'M 15:00-16:55 PP lab',
      'T 09:00-09:55 FLA theory', 'T 10:00-10:55 SC theory', 'T 11:00-12:55 ES lab', 'T 14:00-14:55 OE theory',
      'W 09:00-09:55 SC theory', 'W 10:00-10:55 FLA theory', 'W 11:00-11:55 CS theory', 'W 13:00-14:55 PP lab', 'W 15:00-16:55 CN lab', 'W 17:00-17:55 PP theory',
      'R 09:00-09:55 PP theory', 'R 10:00-10:55 CS theory', 'R 11:00-11:55 ES theory', 'R 12:00-12:55 CN theory', 'R 14:00-14:55 OE theory', 'R 15:00-16:55 SC lab',
      'F 09:00-09:55 CN theory', 'F 10:00-10:55 ES theory', 'F 11:00-11:55 OE theory', 'F 13:00-13:55 FLA theory', 'F 14:00-14:55 SC theory', 'F 15:00-15:55 CS tutorial', 'F 16:00-16:55 OE tutorial',
    ]);
  });

  it('matches the Samarth portal: SC lab on Thursdays 15:00-17:00 for CSE-2', () => {
    const sc = resolveTimetable(SECTION_A, { periods, group: 'CSE-2', legend }).filter((c) => c.course === 'SC' && c.type === 'lab');
    expect(sc).toEqual([{ day: 4, start: '15:00', end: '16:55', course: 'SC', courseName: 'Soft Computing Techniques', courseCode: 'PCAML303D', type: 'lab', venue: 'RS Lab', faculty: ['AS'] }]);
  });

  it('gives other groups their own labs and tutorials, never CSE-2 ones', () => {
    const g1 = week('CSE-1');
    expect(g1).toContain('M 11:00-12:55 PP lab');
    expect(g1).toContain('M 15:00-15:55 OE tutorial');
    expect(g1).not.toContain('M 13:00-13:55 FLA tutorial');
    const g3 = week('cse3'); // typed loosely
    expect(g3).toContain('T 15:00-16:55 CN lab');
    expect(g3).toContain('R 15:00-15:55 CS tutorial');
    // Every group gets the same 20 section-wide lectures.
    for (const g of [g1, g3, week('CSE-2')]) expect(g.filter((x) => x.endsWith('theory'))).toHaveLength(20);
  });

  it('flags what it is unsure about instead of guessing silently', () => {
    const r = resolveTimetable([C(1, 2, 2, 'XY-L JCB-213'), C(1, 3, 4, 'ES Lab')], { periods, group: 'CSE-2', legend });
    expect(r[0].doubt).toMatch(/"XY" is not in the legend/);
    expect(r[1].doubt).toMatch(/Lab with no group named/);
  });
});
