import { and, eq, inArray, like } from 'drizzle-orm';
import { db } from '../../core/db/client';
import { parseLocalDate } from '../../core/utils/date';
import { attendance } from '../attendance/model';
import { dayRules, recurringSchedules, scheduleExceptions } from './model';

export type BorrowedMode = 'holiday' | 'normal' | 'unsure';
export type DayRule = typeof dayRules.$inferSelect;

const weekdayOf = (iso: string) => parseLocalDate(iso).getDay(); // 0=Sun

/**
 * Marks are never deleted by a schedule change, only shadowed: a mark on a class
 * that stops counting becomes Off and remembers what it was ("was:present").
 */
export async function shadowMarks(occurrenceIds: string[]) {
  if (!occurrenceIds.length) return;
  const rows = await db.select().from(attendance).where(inArray(attendance.occurrenceId, occurrenceIds)).all();
  for (const r of rows) {
    if (r.status === 'present' || r.status === 'absent' || r.status === 'exempt') {
      await db.update(attendance).set({ status: 'cancelled', notes: `was:${r.status}` }).where(eq(attendance.id, r.id));
    }
  }
}

/** Bring back shadowed marks on a date, except classes still cancelled one by one. */
async function unshadowDate(date: string) {
  const stillCancelled = new Set((await db.select().from(scheduleExceptions)
    .where(and(eq(scheduleExceptions.specificDate, date), eq(scheduleExceptions.action, 'cancel'))).all())
    .map((e) => `rec_${e.recurringScheduleId}_${date}`));
  const rows = await db.select().from(attendance).where(and(eq(attendance.date, date), like(attendance.notes, 'was:%'))).all();
  for (const r of rows) {
    if (stillCancelled.has(r.occurrenceId)) continue;
    const prev = /^was:(present|absent|exempt)$/.exec(r.notes ?? '')?.[1];
    if (prev) await db.update(attendance).set({ status: prev as any, notes: null }).where(eq(attendance.id, r.id));
  }
}

/** Occurrence ids of a date's own regular classes (its real weekday). */
async function ownSlotIds(date: string) {
  const w = weekdayOf(date);
  return (await db.select().from(recurringSchedules).where(eq(recurringSchedules.dayOfWeek, w)).all()).map((r) => `rec_${r.id}_${date}`);
}

/** Every mark on a date (for a whole day off, extra and moved-in classes stop too). */
async function allMarkIdsOn(date: string) {
  return (await db.select().from(attendance).where(eq(attendance.date, date)).all()).map((r) => r.occurrenceId);
}

export class DayRuleRepository {
  static async forDate(date: string): Promise<DayRule | null> {
    return (await db.select().from(dayRules).where(eq(dayRules.date, date)).get()) ?? null;
  }

  static async all(): Promise<DayRule[]> {
    return db.select().from(dayRules).all();
  }

  /**
   * `date` runs `weekday`'s timetable (0=Sun … 6=Sat). Its own classes stop
   * counting. If `borrowed` names the real date whose timetable was taken and it
   * is a holiday, that date gets a linked day off. Replaces any rule on `date`.
   */
  static async follow(date: string, weekday: number, opts: { reason: string; note?: string; borrowed?: { date: string; mode: BorrowedMode } }) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Pick a date.');
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) throw new Error('Pick a weekday.');
    if (weekday === weekdayOf(date)) throw new Error('That day already follows its own timetable.');
    if (!opts.reason?.trim()) throw new Error('Pick a reason.');
    if (opts.borrowed && weekdayOf(opts.borrowed.date) !== weekday) throw new Error("The borrowed date isn't that weekday.");
    if (opts.borrowed && opts.borrowed.date === date) throw new Error('A day cannot borrow from itself.');
    await this.removeOn(date);
    await shadowMarks(await ownSlotIds(date));
    const rule = await db.insert(dayRules).values({
      date, kind: 'follow', followsWeekday: weekday, reason: opts.reason.trim(), note: opts.note?.trim() || null,
      borrowedDate: opts.borrowed?.date ?? null, borrowedMode: opts.borrowed?.mode ?? null, createdAt: new Date().toISOString(),
    }).returning().get();
    if (opts.borrowed?.mode === 'holiday') {
      await this.removeOn(opts.borrowed.date);
      await shadowMarks(await allMarkIdsOn(opts.borrowed.date));
      await db.insert(dayRules).values({
        date: opts.borrowed.date, kind: 'off', reason: 'Holiday', linkedRuleId: rule.id,
        note: `Its timetable ran on ${date}`, createdAt: new Date().toISOString(),
      });
    }
    return rule;
  }

  /** No classes on `date` (holiday, fest, strike). Replaces any rule on that date. */
  static async dayOff(date: string, opts: { reason: string; note?: string }) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Pick a date.');
    if (!opts.reason?.trim()) throw new Error('Pick a reason.');
    await this.removeOn(date);
    await shadowMarks(await allMarkIdsOn(date));
    return db.insert(dayRules).values({ date, kind: 'off', reason: opts.reason.trim(), note: opts.note?.trim() || null, createdAt: new Date().toISOString() }).returning().get();
  }

  /** Undo the rule on `date` (and a holiday it created), bringing marks back. */
  static async removeOn(date: string) {
    const rule = await this.forDate(date);
    if (!rule) return;
    const linked = await db.select().from(dayRules).where(eq(dayRules.linkedRuleId, rule.id)).all();
    for (const l of linked) {
      await db.delete(dayRules).where(eq(dayRules.id, l.id));
      await unshadowDate(l.date);
    }
    await db.delete(dayRules).where(eq(dayRules.id, rule.id));
    await unshadowDate(date);
  }

  static async remove(id: number) {
    const rule = await db.select().from(dayRules).where(eq(dayRules.id, id)).get();
    if (rule) await this.removeOn(rule.date);
  }

  /** Settle a "not sure yet" borrowed day: it became a holiday, or runs as normal. */
  static async settleBorrowed(followRuleId: number, mode: 'holiday' | 'normal') {
    const rule = await db.select().from(dayRules).where(eq(dayRules.id, followRuleId)).get();
    if (!rule || rule.kind !== 'follow' || !rule.borrowedDate) throw new Error('Nothing to settle.');
    await db.update(dayRules).set({ borrowedMode: mode }).where(eq(dayRules.id, rule.id));
    if (mode === 'holiday') {
      await this.removeOn(rule.borrowedDate);
      await shadowMarks(await allMarkIdsOn(rule.borrowedDate));
      await db.insert(dayRules).values({ date: rule.borrowedDate, kind: 'off', reason: 'Holiday', linkedRuleId: rule.id, note: `Its timetable ran on ${rule.date}`, createdAt: new Date().toISOString() });
    }
  }
}
