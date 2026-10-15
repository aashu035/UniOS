import { eq } from 'drizzle-orm';
import type { Q } from '../../core/db/atomic';
import { attendance } from '../attendance/model';
import { dayRules, scheduleExceptions } from './model';
import { CalendarService } from './service';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const COUNTED = new Set(['present', 'absent', 'exempt']);
const WAS = /^was:(present|absent|exempt)$/;

/** The date a class id belongs to: `rec_<slot>_<date>` carries it; `ex_<id>` does not. */
const dateOfId = (id: string) => /_(\d{4}-\d{2}-\d{2})$/.exec(id)?.[1];

/**
 * Make every mark on `dates` agree with the effective schedule. A mark counts when
 * its class runs; when the class does not run (cancelled, day off, borrowed slot of
 * an undone follow) the mark is shadowed: Off, remembering `was:<status>`.
 *
 * Marks are never deleted, and the schedule is the only source of truth, so the order
 * in which changes were made and undone does not matter. Synchronous: call it inside
 * `atomic()` after writing the change, so the change and its marks commit together.
 */
export function reconcileMarks(q: Q, dates: Iterable<string>) {
  const days = new Set([...dates].filter((d) => d && ISO.test(d)));
  if (!days.size) return;

  // A moved class belongs to its own date and to the date it moved to: a change on
  // either one can start or stop it. Repeat until no move adds a date.
  const moves = q.select().from(scheduleExceptions).where(eq(scheduleExceptions.action, 'move')).all().filter((ex) => ex.targetDate);
  for (let grew = true; grew;) {
    grew = false;
    for (const ex of moves) {
      if (days.has(ex.specificDate) !== days.has(ex.targetDate!)) { days.add(ex.specificDate); days.add(ex.targetDate!); grew = true; }
    }
  }

  // Marks stored on these days, or whose class (rec_<slot>_<date>) belongs to one of them.
  // Legacy rows without an occurrence id are left alone: they cannot be matched to a class.
  const marks = q.select().from(attendance).all().filter((m) => {
    if (!m.occurrenceId) return false;
    const own = dateOfId(m.occurrenceId);
    return (own && days.has(own)) || (ISO.test(m.date) && days.has(m.date));
  });
  if (!marks.length) return;

  const sorted = [...new Set([...days, ...marks.map((m) => m.date).filter((d) => ISO.test(d))])].sort();
  const running = new Set(CalendarService.scheduleIn(q, sorted[0], sorted[sorted.length - 1]).map((o) => o.id));

  for (const m of marks) {
    const prev = WAS.exec(m.notes ?? '')?.[1];
    if (running.has(m.occurrenceId!)) {
      if (prev) q.update(attendance).set({ status: prev as 'present' | 'absent' | 'exempt', notes: null }).where(eq(attendance.id, m.id)).run();
    } else if (COUNTED.has(m.status)) {
      q.update(attendance).set({ status: 'cancelled', notes: `was:${m.status}` }).where(eq(attendance.id, m.id)).run();
    }
  }
}

/**
 * Reconcile every date a schedule change touches, plus marks still shadowed.
 * Runs at startup, so data saved by older versions (which could leave a mark
 * counting on a day off, or Off on a normal day) heals itself.
 */
export function reconcileAllMarks(q: Q) {
  const dates = new Set<string>();
  for (const r of q.select().from(dayRules).all()) { dates.add(r.date); if (r.borrowedDate) dates.add(r.borrowedDate); }
  for (const e of q.select().from(scheduleExceptions).all()) { dates.add(e.specificDate); if (e.targetDate) dates.add(e.targetDate); }
  for (const m of q.select().from(attendance).all()) {
    if (WAS.test(m.notes ?? '')) { dates.add(m.date); const own = dateOfId(m.occurrenceId ?? ''); if (own) dates.add(own); }
  }
  // Check close dates together and far-apart ones separately, so the schedule is never
  // expanded across months that have no changes.
  const sorted = [...dates].filter((d) => ISO.test(d)).sort();
  let group: string[] = [];
  for (const d of sorted) {
    if (group.length && daysBetween(group[group.length - 1], d) > 14) { reconcileMarks(q, group); group = []; }
    group.push(d);
  }
  reconcileMarks(q, group);
}

const daysBetween = (a: string, b: string) => Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))) / 86400000);
