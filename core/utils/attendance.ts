import { countAttendance } from '../../domains/academic/logic';

/**
 * The older services' view of `countAttendance` (domains/academic/logic.ts),
 * which holds the one attendance rule (DCRUST ordinance clause 9, Samarth):
 * % = present / (present + absent + leave), rounded down; Off is not counted.
 * Keep the rule there; this only renames the fields.
 */
export function calculateAttendanceMetrics(records: Array<{ status: string }>) {
  const c = countAttendance(records);
  return {
    present: c.attended,
    absent: c.absent,
    exempt: c.leave,
    cancelledOrHoliday: c.off,
    total: c.total,
    percentage: c.pct,
    hasData: c.total > 0,
  };
}
