import {
  clashBanner, clashesWith, editClass, forGroup, isGeminiKey, maskKey, normGroup, partSummary, periodMinutes, quotaReset,
  readScan, reviewCourses, rowDetail, rowTime, scanErrorKind, toPlan, UnreadableTimetable,
} from '../domains/timetable/scan';

const reply = {
  groups: ['CSE-1', 'CSE-2', 'CSE-3'],
  legend: [{ code: 'SC', name: 'Soft Computing Techniques' }, { code: 'CN', name: 'Computer Networks' }, { code: 'OS', name: '<script>' }],
  classes: [
    { day: 'Monday', startTime: '09:00 AM', endTime: '09:55 AM', subjectCode: 'SC', type: 'theory', venue: 'JCB-213' },
    { day: 'Tuesday', startTime: '10:00 AM', endTime: '10:55 AM', subjectCode: 'SC', type: 'theory', venue: 'JCB-213' },
    { day: 'Monday', startTime: '02:00 PM', endTime: '03:50 PM', subjectCode: 'SC', type: 'lab', group: 'CSE-2', venue: 'RS Lab' },
    { day: 'Monday', startTime: '02:00 PM', endTime: '03:50 PM', subjectCode: 'CN', type: 'lab', group: 'cse 1', venue: 'CN Lab' },
    { day: 'Wednesday', startTime: '11:00 AM', endTime: '11:55 AM', subjectCode: 'CN', type: 'theory' },
    { day: 'Thursday', startTime: '1:00', endTime: '1:55', subjectCode: 'OS', type: 'tutorial', group: 'CSE-2' },
  ],
};

describe('reading the reply', () => {
  it('keeps every valid class with its group, and names from the legend', () => {
    const s = readScan(reply);
    expect(s.classes).toHaveLength(6);
    expect(s.classes[5]).toMatchObject({ code: 'OS', part: 'tutorial', day: 4, start: '13:00', end: '13:55', group: 'CSE-2' });
    expect(s.names).toEqual({ SC: 'Soft Computing Techniques', CN: 'Computer Networks' }); // "<script>" is not a course name
    expect(s.groups).toEqual(['CSE-1', 'CSE-2', 'CSE-3']);
    expect(s.warnings).toEqual([]);
  });

  it('skips hostile or broken rows and counts them, without throwing', () => {
    const s = readScan({ classes: [
      null, 'x', 42, { day: 'constructor', startTime: '9:00', endTime: '10:00', subjectCode: 'SC' },
      { day: 'Monday', startTime: '10:00', endTime: '9:00', subjectCode: 'SC' },
      { day: 'Monday', startTime: '9:00', endTime: '10:00', subjectCode: '*-;₹' },
      { day: 'Monday', startTime: { toString: () => '9:00' }, endTime: '10:00', subjectCode: 'SC' },
      { day: 'Monday', startTime: '9:00', endTime: '10:00', subjectCode: 'SC', type: 'evil', venue: 'x'.repeat(500), group: 7 },
      { day: 'Monday', startTime: '9:00', endTime: '10:00', subjectCode: 'sc' }, // duplicate of the row above
    ], legend: 'nope', groups: [{}, '  ', 'G'.repeat(80)] });
    expect(s.classes).toHaveLength(1);
    expect(s.classes[0]).toMatchObject({ code: 'SC', part: 'theory', group: null });
    expect(s.classes[0].room).toHaveLength(40);
    expect(s.warnings).toEqual(['Skipped 7 cells that couldn\'t be read.']);
    expect(s.groups).toEqual(['G'.repeat(20)]);
    expect(readScan('nope').classes).toEqual([]);
    expect(readScan(reply.classes).classes).toHaveLength(6); // the old bare-list reply still reads
  });
});

describe('group and review', () => {
  const s = readScan(reply);
  it('keeps lectures plus one group\'s labs and tutorials, however the group is written', () => {
    expect(normGroup(' cse – 2 ')).toBe('CSE-2');
    expect(forGroup(s.classes, 'cse2').map((c) => c.code + c.part)).toEqual(['SCtheory', 'SCtheory', 'CNtheory']); // "cse2" is not CSE-2
    expect(forGroup(s.classes, 'CSE 2').map((c) => c.code + c.part)).toEqual(['SCtheory', 'SCtheory', 'SClab', 'CNtheory', 'OStutorial']);
    expect(forGroup(s.classes, 'CSE-1').map((c) => c.code + c.part)).toEqual(['SCtheory', 'SCtheory', 'CNlab', 'CNtheory']);
    expect(forGroup(s.classes, '')).toHaveLength(6);
  });

  it('builds one card per course, marks existing codes, and describes rows', () => {
    const cards = reviewCourses(forGroup(s.classes, 'CSE-2'), s.names, new Set(['CN']));
    expect(cards.map((c) => [c.code, c.name, c.exists, partSummary(c.classes)])).toEqual([
      ['CN', 'Computer Networks', true, '1 lecture'],
      ['OS', 'OS', false, '1 tutorial'],
      ['SC', 'Soft Computing Techniques', false, '2 lectures · 1 lab'],
    ]);
    const lab = cards[2].classes.find((c) => c.part === 'lab')!;
    expect(periodMinutes(s.classes)).toBe(55);
    expect([rowTime(lab), rowDetail(lab, 55)]).toEqual(['Mon 2:00', 'Lab · 2 periods · CSE-2 · RS Lab']);
  });

  it('flags clashes with courses already in the app', () => {
    const taken = [{ workspaceId: 9, name: 'Mathematics-III', short: 'M3', color: '#000', type: 'theory', dayOfWeek: 1, startTime: '09:30', endTime: '10:30' }];
    const c = clashesWith(s.classes, taken);
    expect([...c.keys()]).toEqual([s.classes[0].id]);
    expect(clashBanner(c)).toBe("1 class clashes with your existing course Mathematics-III. They'll both show on the timetable. Tap a class to move it.");
    expect(clashesWith(s.classes, [{ ...taken[0], startTime: '09:55', endTime: '10:00' }]).size).toBe(0); // touching is not a clash
  });

  it('imports only reviewed, new courses, named from the legend', () => {
    const cards = reviewCourses(forGroup(s.classes, 'CSE-2'), s.names, new Set(['CN']));
    const plan = toPlan(cards);
    expect(plan.courses.map((c) => [c.code, c.name, c.components.map((p) => `${p.type}:${p.sessions.length}`).join(' ')])).toEqual([
      ['OS', 'OS', 'theory:0 tutorial:1'],
      ['SC', 'Soft Computing Techniques', 'theory:2 lab:1'],
    ]);
    expect(plan.courses[1].components[1]).toMatchObject({ venueName: 'RS Lab', sessions: [{ dayOfWeek: 1, startTime: '14:00', endTime: '15:50' }] });
  });

  it('edits keep the class length, and a part change sets one or two periods', () => {
    const lec = s.classes[0];
    expect(editClass(lec, { day: 3, start: '11:00' }, 55)).toMatchObject({ day: 3, start: '11:00', end: '11:55' });
    expect(editClass(lec, { part: 'lab' }, 55)).toMatchObject({ part: 'lab', start: '09:00', end: '10:50' });
    expect(editClass(lec, { start: '23:30' }, 55).end).toBe('23:59');
  });
});

describe('errors and the key', () => {
  it('sorts Gemini errors into the screens the design has', () => {
    expect(scanErrorKind(new UnreadableTimetable())).toBe('unreadable');
    expect(scanErrorKind(Object.assign(new Error('No Gemini key'), { name: 'NoGeminiKey' }))).toBe('nokey');
    expect(scanErrorKind(Object.assign(new Error('API key not valid. Please pass a valid API key. API_KEY_INVALID'), { status: 400 }))).toBe('rejected');
    expect(scanErrorKind(Object.assign(new Error('PERMISSION_DENIED'), { status: 403 }))).toBe('rejected');
    expect(scanErrorKind(Object.assign(new Error('RESOURCE_EXHAUSTED quotaId: GenerateRequestsPerDayPerProjectPerModel-FreeTier'), { status: 429 }))).toBe('limit-day');
    expect(scanErrorKind(Object.assign(new Error('RESOURCE_EXHAUSTED GenerateRequestsPerMinutePerProjectPerModel'), { status: 429 }))).toBe('limit-minute');
    expect(scanErrorKind(new TypeError('Network request failed'))).toBe('offline');
    expect(scanErrorKind(Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' }))).toBe('cancelled');
    expect(scanErrorKind(new Error('Internal error'))).toBe('other');
    expect(scanErrorKind(undefined)).toBe('other');
  });

  it('checks the key format before any network call, and masks it', () => {
    const k = 'AIzaSyD3xQ8vLk2TnP0wRb7mZc4Hf9JdUe17Qx0';
    expect(k).toHaveLength(39);
    expect(isGeminiKey(` ${k} `)).toBe(true);
    expect(isGeminiKey('AIza-12345')).toBe(false);
    expect(isGeminiKey(k.slice(0, -1))).toBe(false);
    expect(isGeminiKey(`${k}x`)).toBe(false);
    expect(maskKey(k)).toBe('AIza••••••••••••Qx0');
    expect(maskKey(k)).not.toContain(k.slice(4, 36));
  });

  it('finds the next midnight Pacific, in summer and winter time', () => {
    // 16 Oct 2026, 10:30 IST = 05:00 UTC = 22:00 PDT on the 15th → resets 07:00 UTC (12:30 PM IST).
    expect(quotaReset(new Date('2026-10-16T05:00:00Z')).toISOString()).toBe('2026-10-16T07:00:00.000Z');
    // Winter: PST is UTC-8 → 08:00 UTC (1:30 PM IST).
    expect(quotaReset(new Date('2026-12-10T12:00:00Z')).toISOString()).toBe('2026-12-11T08:00:00.000Z');
    // The night summer time ends (1 Nov 2026): the reset after 23:30 PDT on 31 Oct is midnight PDT.
    expect(quotaReset(new Date('2026-11-01T06:30:00Z')).toISOString()).toBe('2026-11-01T07:00:00.000Z');
    // Just after midnight PST on 1 Nov, the next reset is midnight PST on 2 Nov.
    expect(quotaReset(new Date('2026-11-01T08:30:00Z')).toISOString()).toBe('2026-11-02T08:00:00.000Z');
  });
});
