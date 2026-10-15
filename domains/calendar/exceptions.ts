import { and, eq } from 'drizzle-orm';
import { atomic, type Tx } from '../../core/db/atomic';
import { dayRules, scheduleExceptions, recurringSchedules } from './model';
import { attendance } from '../attendance/model';
import { WorkspaceRepository } from '../workspace/repository';
import { reconcileMarks } from './marks';

/** `rec_<recurringScheduleId>_<YYYY-MM-DD>` is the id CalendarService gives a regular class. */
export function parseRecurringOccurrence(id: string): { recurringScheduleId: number; date: string } | null {
  const m = /^rec_(\d+)_(\d{4}-\d{2}-\d{2})$/.exec(id);
  return m ? { recurringScheduleId: Number(m[1]), date: m[2] } : null;
}

/** A class put on a day off would never show up or count, so it is refused instead. */
function refuseDayOff(tx: Tx, date: string) {
  const rule = tx.select().from(dayRules).where(and(eq(dayRules.date, date), eq(dayRules.kind, 'off'))).get();
  if (rule) throw new Error(`That day is a day off (${rule.reason ?? 'no classes'}). Undo the day off first, or pick another day.`);
}

function slot(tx: Tx, recurringScheduleId: number) {
  const rec = tx.select().from(recurringSchedules).where(eq(recurringSchedules.id, recurringScheduleId)).get();
  if (!rec) throw new Error('That class is no longer on the timetable.');
  return rec;
}

/** Remove the earlier change for this class on `date`; the date it had moved to is touched too. */
function clear(tx: Tx, recurringScheduleId: number, date: string, touched: Set<string>) {
  const where = and(eq(scheduleExceptions.recurringScheduleId, recurringScheduleId), eq(scheduleExceptions.specificDate, date));
  for (const ex of tx.select().from(scheduleExceptions).where(where).all()) if (ex.targetDate) touched.add(ex.targetDate);
  tx.delete(scheduleExceptions).where(where).run();
  touched.add(date);
}

/**
 * One-day changes to a regular class ("temporary change"): cancel it, move it, or
 * add an extra class. Writing a new change replaces any earlier one for that day.
 * Each change and the marks it affects (see reconcileMarks) are saved together.
 */
export class ScheduleExceptionRepository {
  /** Undo a change. A mark that the change turned into "Off" counts again if its class now runs. */
  static async restore(recurringScheduleId: number, date: string) {
    atomic((tx) => {
      const touched = new Set<string>();
      clear(tx, recurringScheduleId, date, touched);
      reconcileMarks(tx, touched);
    });
  }

  /**
   * Cancel one day of a class. If it was already marked present/absent/leave, the
   * mark becomes "Off" (not counted) and remembers what it was, for restore().
   */
  static async cancel(recurringScheduleId: number, date: string, reason?: string) {
    atomic((tx) => {
      const rec = slot(tx, recurringScheduleId);
      const touched = new Set<string>();
      clear(tx, recurringScheduleId, date, touched);
      tx.insert(scheduleExceptions).values({ componentId: rec.componentId, recurringScheduleId, specificDate: date, action: 'cancel', reason: reason?.trim() || null, createdAt: new Date().toISOString() }).run();
      reconcileMarks(tx, touched);
    });
  }

  /**
   * Move one day of a class to another time, and optionally another date
   * (`targetDate`). The class keeps its id, so a mark moves with it.
   */
  static async move(recurringScheduleId: number, date: string, startTime: string, endTime: string, venueName?: string, opts: { targetDate?: string; reason?: string } = {}) {
    if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime) || startTime >= endTime) {
      throw new Error('Pick a start time before the end time.');
    }
    if (opts.targetDate !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(opts.targetDate)) throw new Error('Pick the new date.');
    atomic((tx) => {
      const rec = slot(tx, recurringScheduleId);
      refuseDayOff(tx, opts.targetDate ?? date);
      const venueOverrideId = venueName?.trim() ? WorkspaceRepository.resolveVenue(tx, venueName.trim()) : null;
      const touched = new Set<string>();
      clear(tx, recurringScheduleId, date, touched);
      const targetDate = opts.targetDate && opts.targetDate !== date ? opts.targetDate : null;
      tx.insert(scheduleExceptions).values({
        componentId: rec.componentId, recurringScheduleId, specificDate: date, action: 'move', startTime, endTime, venueOverrideId: venueOverrideId ?? null,
        targetDate, reason: opts.reason?.trim() || null, createdAt: new Date().toISOString(),
      }).run();
      if (targetDate) touched.add(targetDate);
      reconcileMarks(tx, touched);
    });
  }

  /** A one-off extra class (make-up, syllabus catch-up, backlog). */
  static async extra(componentId: number, date: string, startTime: string, endTime: string, opts: { venueName?: string; reason?: string } = {}) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Pick a date.');
    if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime) || startTime >= endTime) throw new Error('Pick a start time before the end time.');
    return atomic((tx) => {
      refuseDayOff(tx, date);
      const venueOverrideId = opts.venueName?.trim() ? WorkspaceRepository.resolveVenue(tx, opts.venueName.trim()) : null;
      return tx.insert(scheduleExceptions).values({
        componentId, specificDate: date, action: 'extra', startTime, endTime, venueOverrideId: venueOverrideId ?? null,
        reason: opts.reason?.trim() || null, createdAt: new Date().toISOString(),
      }).returning().get();
    });
  }

  /** Remove an extra class; its mark goes with it (there is no regular class to fall back to). */
  static async removeExtra(id: number) {
    atomic((tx) => {
      tx.delete(attendance).where(eq(attendance.occurrenceId, `ex_${id}`)).run();
      tx.delete(scheduleExceptions).where(and(eq(scheduleExceptions.id, id), eq(scheduleExceptions.action, 'extra'))).run();
    });
  }
}
