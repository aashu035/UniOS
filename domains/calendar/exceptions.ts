import { and, eq } from 'drizzle-orm';
import { db } from '../../core/db/client';
import { scheduleExceptions, recurringSchedules } from './model';
import { attendance } from '../attendance/model';
import { WorkspaceRepository } from '../workspace/repository';

/** `rec_<recurringScheduleId>_<YYYY-MM-DD>` is the id CalendarService gives a regular class. */
export function parseRecurringOccurrence(id: string): { recurringScheduleId: number; date: string } | null {
  const m = /^rec_(\d+)_(\d{4}-\d{2}-\d{2})$/.exec(id);
  return m ? { recurringScheduleId: Number(m[1]), date: m[2] } : null;
}

/**
 * One-day changes to a regular class ("temporary change"): cancel it, or move it to
 * another time and room. Writing a new change replaces any earlier one for that day.
 */
export class ScheduleExceptionRepository {
  private static async slot(recurringScheduleId: number) {
    const rec = await db.select().from(recurringSchedules).where(eq(recurringSchedules.id, recurringScheduleId)).get();
    if (!rec) throw new Error('That class is no longer on the timetable.');
    return rec;
  }

  private static clear(recurringScheduleId: number, date: string) {
    return db.delete(scheduleExceptions).where(and(
      eq(scheduleExceptions.recurringScheduleId, recurringScheduleId),
      eq(scheduleExceptions.specificDate, date),
    ));
  }

  /** Undo a change. A mark that cancelling turned into "Off" gets its old status back. */
  static async restore(recurringScheduleId: number, date: string) {
    await this.clear(recurringScheduleId, date);
    const occ = `rec_${recurringScheduleId}_${date}`;
    const mark = await db.select().from(attendance).where(eq(attendance.occurrenceId, occ)).get();
    const prev = /^was:(present|absent|exempt)$/.exec(mark?.notes ?? '')?.[1] as 'present' | 'absent' | 'exempt' | undefined;
    if (mark && prev) await db.update(attendance).set({ status: prev, notes: null }).where(eq(attendance.occurrenceId, occ));
  }

  /**
   * Cancel one day of a class. If it was already marked present/absent/leave, the
   * mark becomes "Off" (not counted) and remembers what it was, for restore().
   */
  static async cancel(recurringScheduleId: number, date: string, reason?: string) {
    const rec = await this.slot(recurringScheduleId);
    await this.clear(recurringScheduleId, date);
    await db.insert(scheduleExceptions).values({ componentId: rec.componentId, recurringScheduleId, specificDate: date, action: 'cancel', reason: reason?.trim() || null, createdAt: new Date().toISOString() });
    const occ = `rec_${recurringScheduleId}_${date}`;
    const mark = await db.select().from(attendance).where(eq(attendance.occurrenceId, occ)).get();
    if (mark && (mark.status === 'present' || mark.status === 'absent' || mark.status === 'exempt')) {
      await db.update(attendance).set({ status: 'cancelled', notes: `was:${mark.status}` }).where(eq(attendance.occurrenceId, occ));
    }
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
    const rec = await this.slot(recurringScheduleId);
    const venueOverrideId = venueName?.trim() ? await WorkspaceRepository.resolveVenue(db, venueName.trim()) : null;
    await this.restore(recurringScheduleId, date); // brings back a mark a previous cancel had set to Off
    await db.insert(scheduleExceptions).values({
      componentId: rec.componentId, recurringScheduleId, specificDate: date, action: 'move', startTime, endTime, venueOverrideId: venueOverrideId ?? null,
      targetDate: opts.targetDate && opts.targetDate !== date ? opts.targetDate : null, reason: opts.reason?.trim() || null, createdAt: new Date().toISOString(),
    });
  }

  /** A one-off extra class (make-up, syllabus catch-up, backlog). */
  static async extra(componentId: number, date: string, startTime: string, endTime: string, opts: { venueName?: string; reason?: string } = {}) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Pick a date.');
    if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime) || startTime >= endTime) throw new Error('Pick a start time before the end time.');
    const venueOverrideId = opts.venueName?.trim() ? await WorkspaceRepository.resolveVenue(db, opts.venueName.trim()) : null;
    return db.insert(scheduleExceptions).values({
      componentId, specificDate: date, action: 'extra', startTime, endTime, venueOverrideId: venueOverrideId ?? null,
      reason: opts.reason?.trim() || null, createdAt: new Date().toISOString(),
    }).returning().get();
  }

  /** Remove an extra class; its mark goes with it (there is no regular class to fall back to). */
  static async removeExtra(id: number) {
    await db.delete(attendance).where(eq(attendance.occurrenceId, `ex_${id}`));
    await db.delete(scheduleExceptions).where(and(eq(scheduleExceptions.id, id), eq(scheduleExceptions.action, 'extra')));
  }
}
