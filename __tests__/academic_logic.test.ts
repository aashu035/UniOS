import {
  addDays, canSkip, clock, countAttendance, countdownPct, daySummary, dueGroup, heatmap, isoWeek, liveState,
  markMessage, mondayOf, mustAttend, projectMark, relDue, taskKind, verdict, weekBlocks, deckNote,
} from '../domains/academic/logic';

describe('attendance counts', () => {
  it('counts leave in the total but not as attended, and off not at all (ordinance 9.2, Samarth)', () => {
    const c = countAttendance([{ status: 'present' }, { status: 'exempt' }, { status: 'absent' }, { status: 'cancelled' }, { status: 'holiday' }]);
    expect(c).toEqual({ attended: 1, absent: 1, leave: 1, off: 2, total: 3, pct: 33, pctWithLeave: 67 });
  });
  it('matches the portal: SC lab 6 present, 2 absent, 0 leave of 8 = 75%', () => {
    const c = countAttendance([...Array(6).fill({ status: 'present' }), ...Array(2).fill({ status: 'absent' })]);
    expect(c).toMatchObject({ attended: 6, total: 8, pct: 75 });
  });
  it('has no percentage before anything is marked', () => {
    expect(countAttendance([{ status: 'cancelled' }]).pct).toBeNull();
  });
});

describe('skip budget (numbers from the design mock)', () => {
  it.each([
    // attended, total, need, skip, tone
    [24, 33, 3, 0, 'danger'], // OS 73%: attend the next 3
    [12, 16, 0, 0, 'warn'], // DBMS lab 75%: on the line
    [26, 33, 0, 1, 'warn'], // CN 79%: can skip 1
    [27, 33, 0, 3, 'success'], // DS 82%
    [17, 20, 0, 2, 'success'], // SE 85%
    [29, 33, 0, 5, 'success'], // DM 88%
  ])('%i/%i at 75%%', (a, t, need, skip, tone) => {
    expect(mustAttend(a, t, 75)).toBe(need);
    expect(canSkip(a, t, 75)).toBe(skip);
    expect(verdict(a, t, 75).tone).toBe(tone);
  });

  it('never needs classes when nothing is marked', () => {
    expect(mustAttend(0, 0, 75)).toBe(0);
    expect(verdict(0, 0, 75).tone).toBe('muted');
  });

  it('attending the required classes actually reaches the target', () => {
    for (let t = 1; t <= 60; t++) {
      for (let a = 0; a <= t; a++) {
        const n = mustAttend(a, t, 75);
        expect((a + n) / (t + n)).toBeGreaterThanOrEqual(0.75 - 1e-9);
        if (n > 0) expect((a + n - 1) / (t + n - 1)).toBeLessThan(0.75);
        const s = canSkip(a, t, 75);
        if (a / t >= 0.75) expect(a / (t + s)).toBeGreaterThanOrEqual(0.75 - 1e-9);
      }
    }
  });
});

describe('marking projections', () => {
  const os = { attended: 24, total: 33 };
  it('projects present, absent and off', () => {
    expect(projectMark(os, 'present')).toEqual({ attended: 25, total: 34 });
    expect(projectMark(os, 'absent')).toEqual({ attended: 24, total: 34 });
    expect(projectMark(os, 'off')).toEqual(os);
  });
  it('explains the consequence like the design copy', () => {
    expect(markMessage('OS', os, 75, 'present')).toBe('Marked present. OS is now 74%. Attend 2 more to clear 75%.');
    expect(markMessage('OS', os, 75, 'absent')).toBe('Marked absent. OS drops to 71%. You now need the next 6.');
    expect(markMessage('OS', os, 75, 'off')).toBe('Marked off. The class isn’t counted, so OS stays at 73%.');
  });
  it('writes the deck note for a course under target', () => {
    expect(deckNote('OS', os, 75)).toBe("Even with Present you're under 75%. Attend 2 more after this.");
  });
});

describe('dates and labels', () => {
  it('formats clock times', () => {
    expect(clock('09:00')).toBe('9:00 AM');
    expect(clock('13:30')).toBe('1:30 PM');
    expect(clock('12:00')).toBe('12:00 PM');
    expect(clock('00:15', false)).toBe('12:15');
  });
  it('finds Monday and ISO week (1 Oct 2026 is a Thursday in week 40)', () => {
    expect(mondayOf('2026-10-01')).toBe('2026-09-28');
    expect(mondayOf('2026-10-04')).toBe('2026-09-28');
    expect(isoWeek('2026-10-01')).toBe(40);
    expect(addDays('2026-09-30', 2)).toBe('2026-10-02');
  });
  it('labels due dates and groups them', () => {
    expect(relDue(-2)).toBe('2 days late');
    expect(relDue(0)).toBe('Today');
    expect(relDue(1)).toBe('Tomorrow');
    expect([dueGroup(-1), dueGroup(1), dueGroup(5), dueGroup(10), dueGroup(40), dueGroup(null)]).toEqual(['soon', 'soon', 'week', 'next', 'later', 'undated']);
    expect(countdownPct(0)).toBe(100);
    expect(countdownPct(60)).toBe(8);
  });
  it('maps task types to the three kinds', () => {
    expect([taskKind('exam'), taskKind('quiz'), taskKind('lab'), taskKind('assignment'), taskKind(null)]).toEqual(['exam', 'exam', 'lab', 'assign', 'assign']);
  });
});

describe('week and live class', () => {
  const occ = [
    { date: '2026-10-01', componentType: 'theory', startTime: '09:00', endTime: '10:00', workspaceName: 'OS' },
    { date: '2026-10-01', componentType: 'lab', startTime: '10:30', endTime: '12:30', workspaceName: 'DBMS' },
    { date: '2026-10-01', componentType: 'theory', startTime: '15:00', endTime: '16:00', workspaceName: 'CN', cancelled: true },
    { date: '2026-10-02', componentType: 'theory', startTime: '09:00', endTime: '10:00', workspaceName: 'DS' },
  ];
  const tasks = [
    { id: 1, title: 'Lab file', type: 'lab', dueDate: '2026-10-01', status: 'pending', workspaceId: 1 },
    { id: 2, title: 'Old', type: 'assignment', dueDate: '2026-10-01', status: 'submitted', workspaceId: 1 },
  ];
  it('stacks classes, labs and open tasks per day, skipping cancelled classes', () => {
    const w = weekBlocks(occ, tasks, '2026-09-28');
    expect(w[3]).toEqual(['c', 'l', 't']);
    expect(w[4]).toEqual(['c']);
    expect(w[0]).toEqual([]);
  });
  it('summarises a day', () => {
    const s = daySummary(occ, tasks, '2026-10-01', '2026-10-01');
    expect(s.title).toBe('Today · 1 class, 1 lab, 1 due');
    expect(s.detail).toBe('OS 9:00 AM, DBMS Lab 10:30 AM, CN cancelled, Lab file due.');
  });
  it('finds the class in progress and the next one', () => {
    const today = occ.filter((o) => o.date === '2026-10-01');
    const s = liveState(today, 9 * 60 + 41);
    expect(s.now?.workspaceName).toBe('OS');
    expect(s.minutesLeft).toBe(19);
    expect(s.next?.workspaceName).toBe('DBMS');
    const later = liveState(today, 14 * 60);
    expect(later.now).toBeNull();
    expect(later.next).toBeNull(); // the 3 PM class is cancelled
    expect(later.lastEnded?.workspaceName).toBe('DBMS');
  });
});

describe('heatmap', () => {
  it('rates each day and leaves the future blank', () => {
    const h = heatmap([
      { date: '2026-09-28', status: 'present' },
      { date: '2026-09-29', status: 'present' }, { date: '2026-09-29', status: 'absent' },
      { date: '2026-09-30', status: 'absent' },
      { date: '2026-10-01', status: 'cancelled' },
    ], '2026-10-01', 2);
    expect(h).toHaveLength(2);
    expect(h[1]).toEqual(['all', 'some', 'absent', 'off', 'future', 'future']);
    expect(h[0].every((x) => x === 'none')).toBe(true);
  });
});

describe('files and overall attendance', () => {
  const { fileKind, overall } = require('../domains/academic/derive');
  it('classifies files', () => {
    expect(fileKind({ type: 'document', uri: 'file:///a/Unit 3.PDF' })).toBe('pdf');
    expect(fileKind({ type: 'note', uri: null })).toBe('note');
    expect(fileKind({ type: 'link', uri: 'https://x.y' })).toBe('link');
    expect(fileKind({ type: 'file', uri: 'file:///board.jpg' })).toBe('image');
    expect(fileKind({ type: 'file', uri: 'file:///slides.pptx' })).toBe('other');
  });
  it('sums attendance and picks the common target', () => {
    const c = (attended: number, absent: number, target: number) => ({ att: { attended, absent, off: 1, total: attended + absent }, target });
    expect(overall([c(24, 9, 75), c(29, 4, 75), c(10, 0, 80)])).toEqual({ attended: 63, absent: 13, leave: 0, off: 3, total: 76, pct: 83, target: 75 });
  });
});

describe('course setup grid', () => {
  const { paint, sessionsFor, prune, slotSummary, covers } = require('../domains/academic/setup');
  it('paints, spans labs over two hours and blocks collisions', () => {
    let s = paint({}, '1-9', 'theory', 16);
    s = paint(s, '1-10', 'lab', 16); // Mon 10-12
    expect(paint(s, '1-11', 'theory', 16)).toBe(s); // covered by the lab
    expect(paint(s, '1-8', 'lab', 16)).toBe(s); // would run into the 9 AM class
    expect(paint(s, '2-16', 'lab', 16)).toBe(s); // past the last row
    expect([...covers(s).keys()].sort()).toEqual(['1-10', '1-11', '1-9']);
    expect(sessionsFor(s, 'lab')).toEqual([{ dayOfWeek: 1, startTime: '10:00', endTime: '12:00' }]);
    expect(sessionsFor(s, 'theory')).toEqual([{ dayOfWeek: 1, startTime: '09:00', endTime: '10:00' }]);
    expect(paint(s, '1-10', 'theory', 16)).toEqual({ '1-9': 'theory' }); // tap the start cell to clear
    expect(prune(s, ['theory'])).toEqual({ '1-9': 'theory' });
    expect(slotSummary({ '3-9': 'theory', '1-9': 'theory' })).toBe('2 sessions · Mon, Wed');
  });
  it('allows a 2-hour lab from 4 PM or 5 PM when the grid runs to 7 PM', () => {
    expect(paint({}, '3-16', 'lab', 18)).toEqual({ '3-16': 'lab' });
    expect(sessionsFor(paint({}, '3-17', 'lab', 18), 'lab')).toEqual([{ dayOfWeek: 3, startTime: '17:00', endTime: '19:00' }]);
    expect(paint({}, '3-18', 'lab', 18)).toEqual({}); // would run past 7 PM
  });
});

describe('edge cases found by probing', () => {
  it('never shows Infinity for unreachable or missing targets', () => {
    expect(verdict(9, 10, 100)).toMatchObject({ text: "100% can't be reached anymore", tone: 'danger' });
    expect(verdict(5, 10, 0)).toMatchObject({ text: 'No minimum set' });
    expect(verdict(10, 10, 100).text).not.toMatch(/Infinity|NaN/);
  });
  it('handles odd clock and due values', () => {
    expect(clock('24:00')).toBe('12:00 AM');
    expect(clock('9:5')).toBe('9:05 AM');
    expect(relDue(NaN)).toBe('—');
    expect(dueGroup(NaN)).toBe('undated');
  });
});

describe('timetable lanes', () => {
  const { layoutLanes } = require('../domains/academic/logic');
  const L = (items: Array<[string, number, number]>) => Object.fromEntries([...layoutLanes(items.map(([key, start, end]) => ({ key, start, end }))).entries()].map(([k, v]: any) => [k, `${v.lane}/${v.lanes}`]));
  it('keeps non-overlapping and touching blocks full width', () => {
    expect(L([['a', 540, 600], ['b', 600, 660], ['c', 720, 780]])).toEqual({ a: '0/1', b: '0/1', c: '0/1' });
  });
  it('splits two overlapping classes', () => {
    expect(L([['os', 540, 600], ['dm', 570, 630]])).toEqual({ os: '0/2', dm: '1/2' });
  });
  it('reuses a freed lane inside a chained group, and all share the group width', () => {
    // a 9-11 overlaps b 10-12; c 11-13 overlaps b but not a, so c reuses lane 0.
    expect(L([['a', 540, 660], ['b', 600, 720], ['c', 660, 780]])).toEqual({ a: '0/2', b: '1/2', c: '0/2' });
  });
  it('handles three at once and an identical pair', () => {
    expect(L([['x', 600, 660], ['y', 600, 660], ['z', 610, 640]])).toEqual({ x: '0/3', y: '1/3', z: '2/3' });
  });
  it('starts a fresh group after a gap', () => {
    expect(L([['a', 540, 600], ['b', 550, 600], ['c', 900, 960]])).toEqual({ a: '0/2', b: '1/2', c: '0/1' });
  });
  it('tolerates zero-length and inverted blocks', () => {
    expect(L([['z', 600, 600], ['bad', 700, 650]])).toEqual({ z: '0/1', bad: '0/1' });
  });
});

describe('leave and condonation (ordinance 9.4, 9.5)', () => {
  const { leaveNote, creditsFromHours, countAttendance: count } = require('../domains/academic/logic');
  const att = (p: number, a: number, l: number) => count([...Array(p).fill({ status: 'present' }), ...Array(a).fill({ status: 'absent' }), ...Array(l).fill({ status: 'exempt' })]);
  it('never calls a course safe because of unapproved leave', () => {
    const n = leaveNote(att(14, 2, 4), 75); // 70% official, 90% if approved
    expect(n.tone).toBe('warn');
    expect(n.text).toBe('90% only if your 4 leaves are approved. Submit documents to the chairperson within 7 days of returning.');
  });
  it('explains how much condonation can cover', () => {
    expect(leaveNote(att(68, 32, 0), 75)).toEqual({ text: '7% short. The chairperson can condone up to 10% with medical or duty documents.', tone: 'warn' });
    expect(leaveNote(att(62, 38, 0), 75).tone).toBe('danger'); // 13% short: Dean territory
    expect(leaveNote(att(55, 45, 0), 75).text).toMatch(/more than condonation can cover/);
  });
  it('says nothing when there is nothing to say, and notes leave above target', () => {
    expect(leaveNote(att(0, 0, 0), 75)).toBeNull();
    expect(leaveNote(att(8, 1, 0), 75)).toBeNull();
    expect(leaveNote(att(8, 1, 1), 75)).toEqual({ text: "1 leave not counted. You're above 75% without them.", tone: 'muted' });
  });
  it('derives credits from the teaching scheme (clause 7.11)', () => {
    expect(creditsFromHours({ theory: 3, tutorial: 0, lab: 2 })).toBe(4); // 3-0-2, e.g. Soft Computing
    expect(creditsFromHours({ theory: 3, tutorial: 1, lab: 0 })).toBe(4);
    expect(creditsFromHours({ theory: 2, tutorial: 0, lab: 4 })).toBe(4);
    expect(creditsFromHours({ theory: 0, tutorial: 0, lab: 0 })).toBe(1);
  });
});
