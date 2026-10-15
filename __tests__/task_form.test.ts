import { dueLabel, joinDue, nameError, nextClassOf, nextClassSub, priorityKey, savedToast, splitDue, typeKey } from '../domains/task/form';

describe('task form helpers', () => {
  it('maps stored types to the five chips', () => {
    expect(['assignment', 'quiz', 'lab', 'exam'].map(typeKey)).toEqual(['assignment', 'quiz', 'lab', 'exam']);
    expect(typeKey('todo')).toBe('other');
    expect(typeKey('EXAM')).toBe('exam');
    expect(typeKey(null)).toBe('assignment');
    expect(priorityKey('urgent')).toBe('medium');
  });

  it('needs a name', () => {
    expect(nameError('   ')).toBe('Give the task a name.');
    expect(nameError(' FLA Assignment 2 ')).toBeNull();
  });

  it('stores a due date with or without a time, and reads both back', () => {
    expect(joinDue('2026-10-07', '23:59')).toBe('2026-10-07 23:59');
    expect(joinDue('2026-10-07', null)).toBe('2026-10-07');
    expect(joinDue(null, '23:59')).toBeNull();
    expect(splitDue('2026-10-07 23:59')).toEqual({ date: '2026-10-07', time: '23:59' });
    expect(splitDue('2026-10-07')).toEqual({ date: '2026-10-07', time: null });
    expect(splitDue(null)).toEqual({ date: null, time: null });
    expect(splitDue('not a date')).toEqual({ date: null, time: null });
  });

  it('labels the due date and flags a past one as late', () => {
    expect(dueLabel('2026-10-07', '23:59', '2026-10-07')).toEqual({ text: 'Today, Wed 7 Oct · 11:59 PM', late: false });
    expect(dueLabel('2026-10-08', null, '2026-10-07')).toEqual({ text: 'Tomorrow, Thu 8 Oct', late: false });
    expect(dueLabel('2026-10-05', null, '2026-10-07')).toEqual({ text: 'Mon 5 Oct', late: true });
  });

  it('finds the next class of a course after now, skipping other courses and earlier classes today', () => {
    const occ = [
      { workspaceId: 1, date: '2026-10-07', startTime: '09:00' },
      { workspaceId: 2, date: '2026-10-07', startTime: '15:00' },
      { workspaceId: 1, date: '2026-10-09', startTime: '11:00' },
      { workspaceId: 1, date: '2026-10-08', startTime: '16:00' },
    ];
    expect(nextClassOf(occ, 1, '2026-10-07', 9 * 60 + 41)).toEqual({ date: '2026-10-08', time: '16:00' });
    expect(nextClassOf(occ, 1, '2026-10-07', 8 * 60)).toEqual({ date: '2026-10-07', time: '09:00' });
    expect(nextClassOf(occ, 3, '2026-10-07', 0)).toBeNull();
    expect(nextClassSub({ date: '2026-10-08', time: '16:00' })).toBe('Thu 8 Oct · 4:00');
  });

  it('shortens long names in the toast', () => {
    expect(savedToast('Added', 'PP lab file')).toBe('Added “PP lab file”');
    expect(savedToast('Saved', 'x'.repeat(40), true)).toBe(`Saved “${'x'.repeat(30)}…” · already late`);
  });
});
