import { addDays, clock, dayName, minutesOf, normalizeDate, shortDate } from '../academic/logic';

/** Add / Edit task (design UniTask). Pure helpers, so the screen stays thin and tested. */

export type TaskTypeKey = 'assignment' | 'quiz' | 'lab' | 'exam' | 'other';
export const TASK_TYPES: ReadonlyArray<[TaskTypeKey, string, 'file-pen-line' | 'circle-help' | 'test-tube-diagonal' | 'graduation-cap' | 'circle-dot']> = [
  ['assignment', 'Assignment', 'file-pen-line'],
  ['quiz', 'Quiz', 'circle-help'],
  ['lab', 'Lab file', 'test-tube-diagonal'],
  ['exam', 'Exam', 'graduation-cap'],
  ['other', 'Other', 'circle-dot'],
];

/** A stored type as one of the five chips. Old rows can say "todo" or anything else. */
export function typeKey(t: string | null | undefined): TaskTypeKey {
  const k = (t ?? '').toLowerCase();
  return k === 'assignment' || k === 'quiz' || k === 'lab' || k === 'exam' ? k : t == null || k === '' ? 'assignment' : 'other';
}

export type PriorityKey = 'low' | 'medium' | 'high';
export const PRIORITIES: ReadonlyArray<[PriorityKey, string]> = [['low', 'Low'], ['medium', 'Medium'], ['high', 'High']];
export const priorityKey = (p: string | null | undefined): PriorityKey => (p === 'low' || p === 'high' ? p : 'medium');

export const NAME_MAX = 120;
/** The character counter appears after this many characters. */
export const NAME_COUNTER_FROM = 80;

export function nameError(name: string): string | null {
  return name.trim() ? null : 'Give the task a name.';
}

/**
 * Due dates are stored in `tasks.due_date` as "YYYY-MM-DD", or "YYYY-MM-DD HH:MM" when a
 * time is set (local wall time; normalizeDate reads both). Older rows may hold a timestamp.
 */
export function splitDue(stored: string | null | undefined): { date: string | null; time: string | null } {
  const date = normalizeDate(stored);
  const t = /^\d{4}-\d{2}-\d{2}[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec((stored ?? '').trim());
  return { date, time: date && t ? `${t[1]}:${t[2]}` : null };
}

export function joinDue(date: string | null, time: string | null): string | null {
  if (!date) return null;
  return time && /^\d{2}:\d{2}$/.test(time) ? `${date} ${time}` : date;
}

/** "Today, Wed 7 Oct · 11:59 PM", and whether the date has already passed. */
export function dueLabel(date: string, time: string | null, today: string): { text: string; late: boolean } {
  const prefix = date === today ? 'Today, ' : date === addDays(today, 1) ? 'Tomorrow, ' : '';
  return { text: `${prefix}${dayName(date)} ${shortDate(date)}${time ? ` · ${clock(time)}` : ''}`, late: date < today };
}

/**
 * The course's next class after now, from the effective schedule (schedule changes
 * included: a cancelled class is not in it, a moved one is on its new date).
 */
export function nextClassOf(
  occurrences: ReadonlyArray<{ workspaceId: number; date: string; startTime: string }>,
  courseId: number, today: string, nowMinutes: number,
): { date: string; time: string } | null {
  const next = occurrences
    .filter((o) => o.workspaceId === courseId && (o.date > today || (o.date === today && minutesOf(o.startTime) > nowMinutes)))
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))[0];
  return next ? { date: next.date, time: next.startTime } : null;
}

/** "Thu 8 Oct · 4:00" under the Next class chip. */
export const nextClassSub = (n: { date: string; time: string }) => `${dayName(n.date)} ${shortDate(n.date)} · ${clock(n.time, false)}`;

/** Toast text after saving: the name shortened to 32 characters. */
export function savedToast(kind: 'Added' | 'Saved' | 'Deleted', name: string, late = false): string {
  const n = name.trim();
  return `${kind} “${n.length > 32 ? `${n.slice(0, 30)}…` : n}”${late ? ' · already late' : ''}`;
}
