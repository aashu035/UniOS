import { attendance } from './model';
import { recurringSchedules, scheduleExceptions } from '../calendar/model';
import { courseComponents } from '../workspace/model';
import { eq } from 'drizzle-orm';
import { parseLocalDate, getLocalDateString } from '../../core/utils/date';

/**
 * Structured result from the repair process.
 * Every repair run produces testable counts.
 */
export interface RepairResult {
  resolved: number;
  unresolved_no_match: number;
  unresolved_multiple_matches: number;
  already_resolved: number;
  invalid_blank_identity: number;
  total_legacy_rows: number;
}

/**
 * AttendanceRepairService
 * 
 * Post-migration hook to repair legacy attendance rows where `identity_status`
 * is 'unresolved_legacy'. Uses inline schedule resolution against the same
 * database handle — no separate CalendarService call, no nested transactions.
 * 
 * Idempotency guarantees:
 * 1. Only processes rows with 'unresolved_legacy'.
 * 2. Rejects resolution if multiple occurrences exist for the component on the same date.
 * 3. Rejects resolution if the inferred occurrence ID is already claimed by another row.
 * 4. Returns structured counts for every outcome category.
 * 5. Safe to run on every app initialization.
 */
export class AttendanceRepairService {
  /**
   * @param dbHandle - The same Drizzle database instance used for migrations.
   *                   Must NOT be a nested transaction context.
   */
  static async repairLegacyIdentities(dbHandle: any): Promise<RepairResult> {
    const result: RepairResult = {
      resolved: 0,
      unresolved_no_match: 0,
      unresolved_multiple_matches: 0,
      already_resolved: 0,
      invalid_blank_identity: 0,
      total_legacy_rows: 0,
    };

    // Phase 0: Fix any blank occurrence_id values that slipped through
    const allRows = await dbHandle.select().from(attendance).all();
    for (const row of allRows) {
      if (row.occurrenceId === '') {
        await dbHandle.update(attendance)
          .set({ occurrenceId: null })
          .where(eq(attendance.id, row.id));
        result.invalid_blank_identity++;
      }
    }

    // Phase 1: Find all legacy rows
    const legacyRows = await dbHandle
      .select()
      .from(attendance)
      .where(eq(attendance.identityStatus, 'unresolved_legacy'))
      .all();

    result.total_legacy_rows = legacyRows.length;
    if (legacyRows.length === 0) return result;

    // Phase 2: Load schedule data using the same db handle (no CalendarService call)
    const allRecurring = await dbHandle.select().from(recurringSchedules).all();
    const allComponents = await dbHandle.select().from(courseComponents).all();
    const compMap = new Map(allComponents.map((c: any) => [c.id, c]));

    // Phase 3: Process each legacy row
    for (const row of legacyRows) {
      // Skip rows that already have a valid occurrence_id (shouldn't happen, but defensive)
      if (row.occurrenceId && row.identityStatus === 'resolved') {
        result.already_resolved++;
        continue;
      }

      // Resolve: find all recurring schedules for this component on this date's day-of-week
      const comp = compMap.get(row.componentId);
      if (!comp) {
        result.unresolved_no_match++;
        continue;
      }

      const rowDate = parseLocalDate(row.date);
      const dayOfWeek = rowDate.getDay();

      const matchingSchedules = allRecurring.filter((rec: any) => {
        if (rec.componentId !== row.componentId) return false;
        if (rec.dayOfWeek !== dayOfWeek) return false;
        // Respect effective date bounds
        if (rec.effectiveStartDate && row.date < rec.effectiveStartDate) return false;
        if (rec.effectiveEndDate && row.date > rec.effectiveEndDate) return false;
        return true;
      });

      if (matchingSchedules.length === 0) {
        result.unresolved_no_match++;
        continue;
      }

      if (matchingSchedules.length > 1) {
        result.unresolved_multiple_matches++;
        continue;
      }

      // Exactly one match — construct the occurrence ID
      const targetOccId = `rec_${matchingSchedules[0].id}_${row.date}`;

      // Check if this occurrence ID is already claimed by another row
      const existing = await dbHandle
        .select()
        .from(attendance)
        .where(eq(attendance.occurrenceId, targetOccId))
        .get();

      if (existing) {
        // Already claimed — cannot resolve without risk of duplication
        result.unresolved_multiple_matches++;
        continue;
      }

      // Safe to repair
      await dbHandle.update(attendance)
        .set({
          occurrenceId: targetOccId,
          identityStatus: 'resolved' as const,
        })
        .where(eq(attendance.id, row.id));

      result.resolved++;
    }

    return result;
  }
}
