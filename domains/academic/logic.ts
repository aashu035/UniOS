/**
 * Pure derivations behind the redesigned screens. No database or React here, so
 * everything is unit-tested in `__tests__/academic_logic.test.ts`.
 *
 * Attendance semantics follow the DCRUST B.Tech Ordinance 2024-25, clause 9 and the
 * Samarth portal: Present % = present / (present + absent + leave). Leave (duty or
 * medical) is NOT attendance; it can only be condoned later with documents
 * (chairperson up to 10%, Dean a further 5%). "Off" (cancelled/holiday) is not counted.
 */

export type AttStatus = 'present' | 'absent' | 'exempt' | 'cancelled' | 'holiday';
export type Tone = 'danger' | 'warn' | 'success' | 'muted';

/** `attended` is present only; `total` = present + absent + leave (classes held). */
export interface AttCounts { attended: number; absent: number; leave: number; off: number; total: number; pct: number | null; pctWithLeave: number | null }

export function countAttendance(records: Array<{ status: string }>): AttCounts {
  let present = 0, absent = 0, leave = 0, off = 0;
  for (const r of records) {
    if (r.status === 'present') present++;
    else if (r.status === 'absent') absent++;
    else if (r.status === 'exempt') leave++;
    else if (r.status === 'cancelled' || r.status === 'holiday') off++;
  }
  const total = present + absent + leave;
  return {
    attended: present, absent, leave, off, total,
    pct: total > 0 ? Math.round((present / total) * 100) : null,
    pctWithLeave: total > 0 ? Math.round(((present + leave) / total) * 100) : null,
  };
}

/** Condonation the ordinance allows on documents: chairperson 10% (clause 9.4), Dean a further 5% (9.5). */
export const CONDONE_CHAIR = 10;
export const CONDONE_DEAN = 5;

export interface LeaveNote { text: string; tone: Tone }

/**
 * What leave and condonation mean for a course, or null when there's nothing to say.
 * Never presents leave as safe: it only counts once the department approves it.
 */
export function leaveNote(a: { attended: number; leave: number; total: number; pct: number | null; pctWithLeave: number | null }, target: number): LeaveNote | null {
  if (a.pct === null) return null;
  const leaves = `${a.leave} leave${a.leave === 1 ? '' : 's'}`;
  if (a.pct >= target) return a.leave ? { text: `${leaves} not counted. You're above ${target}% without them.`, tone: 'muted' } : null;
  const shortBy = target - a.pct;
  if (a.leave && (a.pctWithLeave ?? 0) >= target) {
    return { text: `${a.pctWithLeave}% only if your ${leaves} ${a.leave === 1 ? 'is' : 'are'} approved. Submit documents to the chairperson within 7 days of returning.`, tone: 'warn' };
  }
  if (shortBy <= CONDONE_CHAIR) return { text: `${shortBy}% short. The chairperson can condone up to ${CONDONE_CHAIR}% with medical or duty documents.`, tone: 'warn' };
  if (shortBy <= CONDONE_CHAIR + CONDONE_DEAN) return { text: `${shortBy}% short. Beyond the chairperson's ${CONDONE_CHAIR}%; only the Dean can allow ${CONDONE_DEAN}% more in serious cases.`, tone: 'danger' };
  return { text: `${shortBy}% short, more than condonation can cover. Detention risk in this subject.`, tone: 'danger' };
}

/** Credits from the weekly teaching scheme: 1 per hour of lecture or tutorial, 1 per 2 hours of practical (clause 7.11). */
export function creditsFromHours(h: { theory: number; tutorial: number; lab: number }): number {
  return Math.max(1, Math.round(h.theory + h.tutorial + h.lab / 2));
}

/** Classes you can still miss and stay at or above `target`% (0 when already below). */
export function canSkip(attended: number, total: number, target: number): number {
  const t = target / 100;
  if (t <= 0) return Infinity;
  return Math.max(0, Math.floor(attended / t - total + 1e-9));
}

/** Consecutive classes you must attend to reach `target`% (0 when already there). */
export function mustAttend(attended: number, total: number, target: number): number {
  const t = target / 100;
  if (t >= 1) return attended === total ? 0 : Infinity;
  if (total === 0 || attended / total >= t - 1e-9) return 0;
  return Math.ceil((t * total - attended) / (1 - t) - 1e-9);
}

export interface Verdict { text: string; short: string; tone: Tone; need: number; skip: number }

export function verdict(attended: number, total: number, target: number): Verdict {
  if (total === 0) return { text: 'No classes marked yet', short: 'Not started', tone: 'muted', need: 0, skip: 0 };
  const need = mustAttend(attended, total, target);
  const skip = canSkip(attended, total, target);
  if (!Number.isFinite(need)) return { text: `${target}% can't be reached anymore`, short: 'Out of reach', tone: 'danger', need: Infinity, skip: 0 };
  if (!Number.isFinite(skip)) return { text: 'No minimum set', short: 'No minimum', tone: 'success', need: 0, skip: Infinity };
  if (need > 0) return { text: `Attend the next ${need} class${need === 1 ? '' : 'es'}`, short: `Attend the next ${need}`, tone: 'danger', need, skip: 0 };
  if (skip === 0) return { text: 'On the line. Don’t skip the next one', short: 'On the line', tone: 'warn', need, skip };
  return { text: `You can skip ${skip}`, short: `Can skip ${skip}`, tone: skip <= 1 ? 'warn' : 'success', need, skip };
}

export const pctOf = (a: number, t: number) => (t > 0 ? Math.round((a / t) * 100) : null);

/** Where a course lands after marking the next class. */
export function projectMark(c: { attended: number; total: number }, mark: 'present' | 'absent' | 'off') {
  if (mark === 'present') return { attended: c.attended + 1, total: c.total + 1 };
  if (mark === 'absent') return { attended: c.attended, total: c.total + 1 };
  return { attended: c.attended, total: c.total };
}

/** The one-line consequence shown under the live class. `short` is the course's short label ("OS"). */
export function markMessage(short: string, c: { attended: number; total: number }, target: number, mark: 'present' | 'absent' | 'off' | null): string {
  if (!mark) return 'Tap to mark. Off means the class wasn’t held and isn’t counted.';
  const after = projectMark(c, mark);
  const pct = pctOf(after.attended, after.total);
  const need = mustAttend(after.attended, after.total, target);
  if (mark === 'off') return `Marked off. The class isn’t counted, so ${short} stays at ${pct ?? '–'}%.`;
  if (mark === 'present') {
    return need > 0
      ? `Marked present. ${short} is now ${pct}%. Attend ${need} more to clear ${target}%.`
      : `Marked present. ${short} is now ${pct}%.`;
  }
  return need > 0
    ? `Marked absent. ${short} drops to ${pct}%. You now need the next ${need}.`
    : `Marked absent. ${short} drops to ${pct}%.`;
}

export function deckNote(short: string, c: { attended: number; total: number }, target: number): string {
  const p = projectMark(c, 'present');
  if (mustAttend(p.attended, p.total, target) > 0) {
    return `Even with Present you're under ${target}%. Attend ${mustAttend(p.attended, p.total, target)} more after this.`;
  }
  const a = projectMark(c, 'absent');
  return `Absent drops ${short} to ${pctOf(a.attended, a.total)}%. You can still miss ${canSkip(a.attended, a.total, target)} after that.`;
}

// ─── Time ─────────────────────────────────────────────────────────────────────

export const hoursOf = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) + (m || 0) / 60;
};
export const minutesOf = (hhmm: string) => Math.round(hoursOf(hhmm) * 60);

/** 13:30 -> "1:30 PM" (or "1:30" with `ampm: false`). */
export function clock(hhmm: string, ampm = true): string {
  const [h, m] = hhmm.split(':').map(Number);
  const h24 = (h || 0) % 24;
  const hh = h24 % 12 === 0 ? 12 : h24 % 12;
  const base = `${hh}:${String(m || 0).padStart(2, '0')}`;
  return ampm ? `${base} ${h24 >= 12 ? 'PM' : 'AM'}` : base;
}

export function addDays(iso: string, n: number): string {
  const [y, mo, d] = iso.split('-').map(Number);
  const dt = new Date(y, mo - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

export function daysBetween(fromIso: string, toIso: string): number {
  const [a, b] = [fromIso, toIso].map((s) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); });
  return Math.round((b - a) / 86400000);
}

export function weekday(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

/** Monday of the week containing `iso`. */
export function mondayOf(iso: string): string {
  const wd = weekday(iso);
  return addDays(iso, wd === 0 ? -6 : 1 - wd);
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function dayName(iso: string, long = false) { return (long ? DAY_LONG : DAY)[weekday(iso)]; }
export function shortDate(iso: string) { const [, m, d] = iso.split('-').map(Number); return `${d} ${MON[m - 1]}`; }
export function dayDate(iso: string) { return `${dayName(iso)}, ${shortDate(iso)}`; }

/** ISO-8601 week number. */
export function isoWeek(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - y0.getTime()) / 86400000 + 1) / 7);
}

/** "Today", "Tomorrow", "5 days", "2 days late". */
export function relDue(days: number): string {
  if (!Number.isFinite(days)) return '—';
  if (days < 0) return `${-days} day${days === -1 ? '' : 's'} late`;
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `${days} days`;
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

export type TaskKind = 'exam' | 'assign' | 'lab';

export function taskKind(type: string | null | undefined): TaskKind {
  if (type === 'exam' || type === 'quiz') return 'exam';
  if (type === 'lab') return 'lab';
  return 'assign';
}

export const isDone = (status: string | null | undefined) => status === 'submitted' || status === 'graded' || status === 'completed';

export interface TaskLike { id: number; title: string; type: string | null; dueDate: string | null; status: string | null; workspaceId: number | null }

export type DueGroup = 'soon' | 'week' | 'next' | 'later' | 'undated';

/** Bucket open tasks the way the Tasks screen groups them. Overdue counts as "soon". */
export function dueGroup(days: number | null): DueGroup {
  if (days === null || !Number.isFinite(days)) return 'undated';
  if (days <= 1) return 'soon';
  if (days <= 7) return 'week';
  if (days <= 14) return 'next';
  return 'later';
}

/** Countdown ring fill: a full ring today, emptying over 30 days. */
export function countdownPct(days: number) { return Math.max(8, Math.min(100, Math.round(100 - (days / 30) * 100))); }

// ─── Week / heatmap ──────────────────────────────────────────────────────────

export type Block = 'c' | 'l' | 't';
export interface OccLike { date: string; componentType: string; startTime: string; endTime: string; workspaceName: string; cancelled?: boolean; exceptionAction?: string }

/** Stacked blocks for each of 7 days from `weekStart`: classes, labs, then things due. */
export function weekBlocks(occ: OccLike[], tasks: TaskLike[], weekStart: string): Block[][] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(weekStart, i);
    const blocks: Block[] = occ.filter((o) => o.date === d && !o.cancelled).map((o) => (o.componentType === 'lab' ? 'l' : 'c'));
    const due = tasks.filter((t) => t.dueDate === d && !isDone(t.status)).length;
    for (let k = 0; k < due; k++) blocks.push('t');
    return blocks;
  });
}

export function daySummary<O extends OccLike>(occ: O[], tasks: TaskLike[], day: string, today: string, label: (o: O) => string = (o) => o.workspaceName): { title: string; detail: string } {
  const live = occ.filter((o) => o.date === day && !o.cancelled);
  const labs = live.filter((o) => o.componentType === 'lab').length;
  const classes = live.length - labs;
  const due = tasks.filter((t) => t.dueDate === day && !isDone(t.status));
  const parts = [classes && `${classes} class${classes === 1 ? '' : 'es'}`, labs && `${labs} lab${labs === 1 ? '' : 's'}`, due.length && `${due.length} due`].filter(Boolean);
  const name = day === today ? 'Today' : dayName(day);
  const title = parts.length ? `${name} · ${parts.join(', ')}` : `${name} · free`;
  const list = occ.filter((o) => o.date === day).map((o) =>
    o.cancelled ? `${label(o)} cancelled` : `${label(o)}${o.componentType === 'lab' ? ' Lab' : ''} ${clock(o.startTime)}${o.exceptionAction === 'move' ? ' (moved)' : ''}`);
  const dueTxt = due.map((t) => `${t.title} due`);
  const detail = [...list, ...dueTxt].join(', ');
  return { title, detail: detail ? detail + '.' : 'Nothing scheduled.' };
}

export type HeatLevel = 'all' | 'some' | 'absent' | 'off' | 'none' | 'future';

/** `weeks` columns of Mon–Sat cells ending with the week of `today`. */
export function heatmap(records: Array<{ date: string; status: string }>, today: string, weeks = 12): HeatLevel[][] {
  const byDay = new Map<string, string[]>();
  for (const r of records) {
    const list = byDay.get(r.date) ?? [];
    list.push(r.status);
    byDay.set(r.date, list);
  }
  const start = addDays(mondayOf(today), -7 * (weeks - 1));
  return Array.from({ length: weeks }, (_, w) => Array.from({ length: 6 }, (_, d) => {
    const day = addDays(start, w * 7 + d);
    if (day > today) return 'future';
    const s = byDay.get(day);
    if (!s || !s.length) return 'none';
    const counted = s.filter((x) => x !== 'cancelled' && x !== 'holiday');
    if (!counted.length) return 'off';
    const att = counted.filter((x) => x === 'present' || x === 'exempt').length;
    if (att === counted.length) return 'all';
    if (att === 0) return 'absent';
    return 'some';
  }));
}

// ─── Live class ──────────────────────────────────────────────────────────────

export function liveState<O extends { startTime: string; endTime: string; cancelled?: boolean }>(todayOcc: O[], nowMin: number) {
  const live = todayOcc.filter((o) => !o.cancelled);
  const now = live.find((o) => minutesOf(o.startTime) <= nowMin && nowMin < minutesOf(o.endTime)) ?? null;
  const next = live.find((o) => minutesOf(o.startTime) > nowMin) ?? null;
  const minutesLeft = now ? minutesOf(now.endTime) - nowMin : 0;
  const progress = now ? (nowMin - minutesOf(now.startTime)) / Math.max(1, minutesOf(now.endTime) - minutesOf(now.startTime)) : 0;
  const ended = live.filter((o) => minutesOf(o.endTime) <= nowMin);
  return { now, next, minutesLeft, progress, lastEnded: ended[ended.length - 1] ?? null };
}

export function inMinutes(m: number): string {
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

// ─── Timetable lanes ─────────────────────────────────────────────────────────

export interface LaneSlot { lane: number; lanes: number }

/**
 * Side-by-side columns for overlapping blocks on the day timeline. Blocks that
 * overlap (directly or through a chain) form a group; each takes the lowest free
 * lane, and every block in the group shares the group's lane count so widths match.
 * Touching blocks (one ends as the next starts) don't overlap.
 */
export function layoutLanes(items: Array<{ key: string; start: number; end: number }>): Map<string, LaneSlot> {
  const sorted = items.slice().sort((a, b) => a.start - b.start || b.end - a.end || a.key.localeCompare(b.key));
  const out = new Map<string, LaneSlot>();
  let group: Array<{ key: string; lane: number }> = [];
  let laneEnds: number[] = [];
  let groupEnd = -Infinity;
  const flush = () => {
    for (const g of group) out.set(g.key, { lane: g.lane, lanes: laneEnds.length });
    group = []; laneEnds = [];
  };
  for (const it of sorted) {
    const end = Math.max(it.end, it.start);
    if (it.start >= groupEnd) { flush(); groupEnd = -Infinity; }
    let lane = laneEnds.findIndex((e) => e <= it.start);
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(end); } else laneEnds[lane] = end;
    group.push({ key: it.key, lane });
    groupEnd = Math.max(groupEnd, end);
  }
  flush();
  return out;
}
