import { and, eq } from 'drizzle-orm';
import { db } from '../../core/db/client';
import { scheduleExceptions, recurringSchedules } from './model';
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

  static async restore(recurringScheduleId: number, date: string) {
    await db.delete(scheduleExceptions).where(and(
      eq(scheduleExceptions.recurringScheduleId, recurringScheduleId),
      eq(scheduleExceptions.specificDate, date),
    ));
  }

  static async cancel(recurringScheduleId: number, date: string) {
    const rec = await this.slot(recurringScheduleId);
    await this.restore(recurringScheduleId, date);
    await db.insert(scheduleExceptions).values({ componentId: rec.componentId, recurringScheduleId, specificDate: date, action: 'cancel' });
  }

  static async move(recurringScheduleId: number, date: string, startTime: string, endTime: string, venueName?: string) {
    if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime) || startTime >= endTime) {
      throw new Error('Pick a start time before the end time.');
    }
    const rec = await this.slot(recurringScheduleId);
    const venueOverrideId = venueName?.trim() ? await WorkspaceRepository.resolveVenue(db, venueName.trim()) : null;
    await this.restore(recurringScheduleId, date);
    await db.insert(scheduleExceptions).values({
      componentId: rec.componentId, recurringScheduleId, specificDate: date, action: 'move', startTime, endTime, venueOverrideId: venueOverrideId ?? null,
    });
  }
}
