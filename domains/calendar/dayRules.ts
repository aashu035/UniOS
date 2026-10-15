import { eq } from 'drizzle-orm';
import { db } from '../../core/db/client';
import { atomic, type Tx } from '../../core/db/atomic';
import { parseLocalDate } from '../../core/utils/date';
import { reconcileMarks } from './marks';
import { dayRules } from './model';

export type BorrowedMode = 'holiday' | 'normal' | 'unsure';
export type DayRule = typeof dayRules.$inferSelect;

const weekdayOf = (iso: string) => parseLocalDate(iso).getDay(); // 0=Sun

/**
 * Remove the rule on `date` and the holiday it created, inside `tx`. Adds every date
 * whose classes change to `touched`, for reconcileMarks.
 */
function removeRule(tx: Tx, date: string, touched: Set<string>) {
  const rule = tx.select().from(dayRules).where(eq(dayRules.date, date)).get();
  if (!rule) return;
  for (const l of tx.select().from(dayRules).where(eq(dayRules.linkedRuleId, rule.id)).all()) {
    tx.delete(dayRules).where(eq(dayRules.id, l.id)).run();
    touched.add(l.date);
  }
  // This day was the holiday of another day's follow: that day no longer makes it one.
  if (rule.linkedRuleId) tx.update(dayRules).set({ borrowedMode: 'normal' }).where(eq(dayRules.id, rule.linkedRuleId)).run();
  tx.delete(dayRules).where(eq(dayRules.id, rule.id)).run();
  touched.add(date);
}

/** A holiday on `date` because its timetable ran on `ranOn` (rule `followRuleId`). */
function addLinkedHoliday(tx: Tx, date: string, ranOn: string, followRuleId: number, touched: Set<string>) {
  removeRule(tx, date, touched);
  tx.insert(dayRules).values({
    date, kind: 'off', reason: 'Holiday', linkedRuleId: followRuleId,
    note: `Its timetable ran on ${ranOn}`, createdAt: new Date().toISOString(),
  }).run();
  touched.add(date);
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
   * The rule and the marks it shadows are saved together, or not at all.
   */
  static async follow(date: string, weekday: number, opts: { reason: string; note?: string; borrowed?: { date: string; mode: BorrowedMode } }) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Pick a date.');
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) throw new Error('Pick a weekday.');
    if (weekday === weekdayOf(date)) throw new Error('That day already follows its own timetable.');
    if (!opts.reason?.trim()) throw new Error('Pick a reason.');
    if (opts.borrowed && weekdayOf(opts.borrowed.date) !== weekday) throw new Error("The borrowed date isn't that weekday.");
    if (opts.borrowed && opts.borrowed.date === date) throw new Error('A day cannot borrow from itself.');
    return atomic((tx) => {
      const touched = new Set<string>([date]);
      removeRule(tx, date, touched);
      const rule = tx.insert(dayRules).values({
        date, kind: 'follow', followsWeekday: weekday, reason: opts.reason.trim(), note: opts.note?.trim() || null,
        borrowedDate: opts.borrowed?.date ?? null, borrowedMode: opts.borrowed?.mode ?? null, createdAt: new Date().toISOString(),
      }).returning().get();
      if (opts.borrowed?.mode === 'holiday') addLinkedHoliday(tx, opts.borrowed.date, date, rule.id, touched);
      reconcileMarks(tx, touched);
      return rule;
    });
  }

  /** No classes on `date` (holiday, fest, strike). Replaces any rule on that date. */
  static async dayOff(date: string, opts: { reason: string; note?: string }) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Pick a date.');
    if (!opts.reason?.trim()) throw new Error('Pick a reason.');
    return atomic((tx) => {
      const touched = new Set<string>([date]);
      removeRule(tx, date, touched);
      const rule = tx.insert(dayRules).values({ date, kind: 'off', reason: opts.reason.trim(), note: opts.note?.trim() || null, createdAt: new Date().toISOString() }).returning().get();
      reconcileMarks(tx, touched);
      return rule;
    });
  }

  /**
   * Undo the rule on `date` (and a holiday it created). The date's own classes
   * and their marks come back; marks made on classes borrowed from another
   * weekday stop counting (they come back if the change is made again).
   */
  static async removeOn(date: string) {
    atomic((tx) => {
      const touched = new Set<string>();
      removeRule(tx, date, touched);
      reconcileMarks(tx, touched);
    });
  }

  static async remove(id: number) {
    const rule = await db.select().from(dayRules).where(eq(dayRules.id, id)).get();
    if (rule) await this.removeOn(rule.date);
  }

  /** Settle a "not sure yet" borrowed day: it became a holiday, or runs as normal. */
  static async settleBorrowed(followRuleId: number, mode: 'holiday' | 'normal') {
    atomic((tx) => {
      const rule = tx.select().from(dayRules).where(eq(dayRules.id, followRuleId)).get();
      if (!rule || rule.kind !== 'follow' || !rule.borrowedDate) throw new Error('Nothing to settle.');
      tx.update(dayRules).set({ borrowedMode: mode }).where(eq(dayRules.id, rule.id)).run();
      const touched = new Set<string>();
      if (mode === 'holiday') addLinkedHoliday(tx, rule.borrowedDate, rule.date, rule.id, touched);
      reconcileMarks(tx, touched);
    });
  }
}
