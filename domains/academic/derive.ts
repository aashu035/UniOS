import type { IconName } from '../../components/uni/Icon';
import { addDays, clock, dayName, daysBetween, isDone, liveState, minutesOf, mustAttend, relDue, pctOf } from './logic';
import type { Course, Occ, Snapshot, TaskRow } from './snapshot';

export type AlertTone = 'danger' | 'warn' | 'primary' | 'success';

export interface DeckAlert {
  key: string;
  tone: AlertTone;
  icon: IconName;
  eyebrow: string;
  title: string;
  body: string;
  cta: string;
  route: string;
}

export const dayWord = (today: string, date: string) => (date === today ? 'today' : date === addDays(today, 1) ? 'tomorrow' : '');

/** Courses below target, riskiest (most classes needed) first. */
export function atRisk(courses: Course[]) {
  return courses
    .filter((c) => c.att.total > 0 && c.att.pct !== null && c.att.pct < c.target)
    .map((c) => ({ course: c, need: mustAttend(c.att.attended, c.att.total, c.target) }))
    .sort((a, b) => (b.need === a.need ? 0 : b.need > a.need ? 1 : -1));
}

export function openTasks(s: Snapshot): Array<TaskRow & { days: number | null }> {
  return s.tasks
    .filter((t) => !isDone(t.status))
    .map((t) => ({ ...t, days: t.dueDate ? daysBetween(s.today, t.dueDate) : null }))
    .sort((a, b) => (a.days ?? 9999) - (b.days ?? 9999));
}

export function changes(s: Snapshot, from: string, to: string): Occ[] {
  return s.occurrences.filter((o) => o.date >= from && o.date <= to && (o.cancelled || o.exceptionAction === 'move' || o.exceptionAction === 'extra'));
}

/** The swipeable alert deck on Home: attendance risk, things due, schedule changes. */
export function buildAlerts(s: Snapshot): DeckAlert[] {
  const out: DeckAlert[] = [];
  for (const { course: c, need } of atRisk(s.courses).slice(0, 2)) {
    out.push({
      key: `att-${c.id}`, tone: 'danger', icon: 'triangle-alert', eyebrow: `Attendance · ${c.short}`, cta: 'See plan',
      title: `${c.att.pct}%, below your ${c.target}% target`,
      body: Number.isFinite(need) ? `Attend the next ${need} ${c.short} class${need === 1 ? '' : 'es'} to get back above target.` : `${c.target}% can't be reached anymore. Every class still counts.`,
      route: '/attendance',
    });
  }
  const soon = openTasks(s).filter((t) => t.days !== null && t.days <= 1);
  if (soon.length) {
    const t = soon[0];
    const course = t.workspaceId ? s.courseById.get(t.workspaceId) : undefined;
    const more = soon.length - 1;
    out.push({
      key: `task-${t.id}`, tone: 'warn', icon: t.type === 'lab' ? 'test-tube-diagonal' : t.type === 'exam' || t.type === 'quiz' ? 'graduation-cap' : 'file-pen-line',
      eyebrow: t.days! < 0 ? 'Overdue' : t.days === 0 ? 'Due today' : 'Due tomorrow', cta: 'Open', title: t.title,
      body: [course?.name, t.days! < 0 ? relDue(t.days!) : null, more > 0 ? `${more} more due by tomorrow.` : null].filter(Boolean).join(' · '),
      route: '/(main)/work',
    });
  }
  for (const o of changes(s, s.today, addDays(s.today, 1)).slice(0, 2)) {
    const when = dayWord(s.today, o.date);
    out.push(o.cancelled
      ? { key: `chg-${o.id}`, tone: 'primary', icon: 'party-popper', eyebrow: 'Schedule change', cta: 'View', title: `${o.workspaceName} cancelled ${when}`,
          body: 'It won’t count toward your attendance.', route: '/(main)/schedule' }
      : { key: `chg-${o.id}`, tone: 'primary', icon: 'calendar-clock', eyebrow: 'Schedule change', cta: 'View',
          title: o.exceptionAction === 'extra' ? `Extra ${o.workspaceName} class ${when}` : `${o.workspaceName} moved to ${clock(o.startTime)} ${when}`,
          body: [o.venueName, o.original ? `Was ${clock(o.original.startTime)}.` : null].filter(Boolean).join(' · ') || 'Check the timetable for details.',
          route: '/(main)/schedule' });
  }
  return out;
}

/** "Suggested now" in the create sheet: the live or just-finished class that still needs marking. */
export function suggestion(s: Snapshot, nowMin: number): { text: string; route: string } | null {
  const today = s.occurrences.filter((o) => o.date === s.today);
  const live = liveState(today, nowMin);
  const short = (o: Occ) => s.courseById.get(o.workspaceId)?.short ?? o.workspaceName;
  if (live.now && !live.now.status) return { text: `${short(live.now)} ends in ${live.minutesLeft} min. Mark attendance?`, route: '/attendance/mark' };
  const pending = today.filter((o) => !o.cancelled && !o.status && minutesOf(o.endTime) <= nowMin);
  if (pending.length) {
    const o = pending[pending.length - 1];
    return { text: pending.length > 1 ? `${pending.length} classes today aren't marked yet.` : `${short(o)} ended at ${clock(o.endTime)}. Mark it?`, route: '/attendance/mark' };
  }
  return null;
}

/** Today's classes the mark deck walks through (unmarked, not cancelled). */
export function markQueue(s: Snapshot): Occ[] {
  return s.occurrences.filter((o) => o.date === s.today && !o.cancelled && o.componentId && !o.status);
}

export type FileKind = 'pdf' | 'note' | 'image' | 'link' | 'other';

export function fileKind(f: { type: string | null; uri: string | null }): FileKind {
  const uri = (f.uri ?? '').toLowerCase();
  if (f.type === 'link' || /^https?:\/\//.test(uri)) return 'link';
  if (f.type === 'note' || (!f.uri && f.type !== 'pdf')) return 'note';
  if (f.type === 'pdf' || uri.endsWith('.pdf')) return 'pdf';
  if (f.type === 'image' || /\.(png|jpe?g|gif|webp|heic)$/.test(uri)) return 'image';
  return 'other';
}

/** Overall attendance across courses, against the target most courses use. */
export function overall(courses: Course[]) {
  const attended = courses.reduce((a, c) => a + c.att.attended, 0);
  const absent = courses.reduce((a, c) => a + c.att.absent, 0);
  const leave = courses.reduce((a, c) => a + (c.att.leave ?? 0), 0);
  const off = courses.reduce((a, c) => a + c.att.off, 0);
  const total = attended + absent + leave;
  const counts = new Map<number, number>();
  for (const c of courses) counts.set(c.target, (counts.get(c.target) ?? 0) + 1);
  const target = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 75;
  return { attended, absent, leave, off, total, pct: pctOf(attended, total), target };
}

const WEEKDAY_NAME = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Banner for a day whose timetable changed: today's rule all day, and tomorrow's
 * from 6 PM the evening before, so nobody packs the wrong bag.
 */
export function dayRuleBanner(s: Pick<Snapshot, 'dayRules' | 'today'>, nowMin: number): { date: string; when: 'today' | 'tomorrow'; title: string; body: string } | null {
  const pick = (date: string) => s.dayRules.find((r) => r.date === date);
  const tomorrow = addDays(s.today, 1);
  const r = pick(s.today) ?? (nowMin >= 18 * 60 ? pick(tomorrow) : undefined);
  if (!r) return null;
  const when = r.date === s.today ? 'today' : 'tomorrow';
  const Cap = when === 'today' ? 'Today' : 'Tomorrow';
  const why = [r.reason, r.note].filter(Boolean).join(' · ');
  if (r.kind === 'follow' && r.followsWeekday !== null) {
    const wd = WEEKDAY_NAME[r.followsWeekday];
    return { date: r.date, when, title: `${Cap} follows ${wd}'s timetable`, body: `Bring ${wd}'s books. ${dayName(r.date, true)}'s own classes don't count.${why ? ` ${why}.` : ''}` };
  }
  return { date: r.date, when, title: `${Cap} is off`, body: `No classes count${why ? ` · ${why}` : ''}.` };
}
