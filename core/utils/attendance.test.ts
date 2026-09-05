import { calculateAttendanceMetrics } from './attendance';

/**
 * These tests pin down the exact business rules for attendance metrics.
 * The same utility is consumed by:
 *   - AttendanceViewModelBuilder (domains/attendance/viewmodel.ts) — the hero/chart/ring screens
 *   - CourseListService (domains/workspace/CourseListService.ts) — the workspace list card
 *   - CourseOverviewService (domains/workspace/CourseOverviewService.ts) — the workspace detail
 *   - WorkspaceRepository.getCompleteWorkspace (domains/workspace/repository.ts) — per-component
 *
 * If you change a rule here, ALL of those screens change in lockstep.
 * Do not inline attendance math anywhere else — use this utility.
 */
describe('attendance utils — canonical metric engine', () => {
  describe('calculateAttendanceMetrics — business rules', () => {
    it('counts exempt (Duty/Medical) as attended for percentage', () => {
      // 3 present + 1 exempt + 2 absent = 6 conducted, 4 attended
      // Note: `present` is the RAW count of 'present' records; exempt is its own field.
      // The denominator (total) includes both, and the percentage is (present+exempt)/total.
      const result = calculateAttendanceMetrics([
        { status: 'present' },
        { status: 'present' },
        { status: 'present' },
        { status: 'exempt' },
        { status: 'absent' },
        { status: 'absent' },
      ]);
      expect(result.present).toBe(3);
      expect(result.absent).toBe(2);
      expect(result.exempt).toBe(1);
      expect(result.total).toBe(6);
      expect(result.percentage).toBe(67); // (3+1)/6 = 0.666... → 67
    });

    it('exports present and exempt as separate fields (consumer adds them for "effective attended")', () => {
      // The hero attendance screen reads viewModel.summary.present and adds
      // viewModel.summary.exempt to compute "effective attended" for the
      // target% recovery calculation. Pin this contract.
      const result = calculateAttendanceMetrics([
        { status: 'present' },
        { status: 'exempt' },
        { status: 'absent' },
      ]);
      const effectiveAttended = result.present + result.exempt;
      expect(effectiveAttended).toBe(2);
      expect(result.percentage).toBe(67); // (1+1)/3 = 0.666... → 67
    });

    it('excludes holiday and cancelled from the denominator', () => {
      // 2 present, 1 absent, 1 holiday, 1 cancelled
      // Only present+absent count in the denominator (3 conducted, 2 attended)
      const result = calculateAttendanceMetrics([
        { status: 'present' },
        { status: 'present' },
        { status: 'absent' },
        { status: 'holiday' },
        { status: 'cancelled' },
      ]);
      expect(result.present).toBe(2);
      expect(result.absent).toBe(1);
      expect(result.cancelledOrHoliday).toBe(2);
      expect(result.total).toBe(3); // excludes holiday/cancelled
      expect(result.percentage).toBe(67); // 2/3 rounded
    });

    it('returns null percentage and hasData=false for empty records', () => {
      const result = calculateAttendanceMetrics([]);
      expect(result.percentage).toBeNull();
      expect(result.hasData).toBe(false);
      expect(result.total).toBe(0);
      expect(result.present).toBe(0);
      expect(result.absent).toBe(0);
      expect(result.exempt).toBe(0);
      expect(result.cancelledOrHoliday).toBe(0);
    });

    it('returns null percentage when all records are holiday/cancelled (no denominator)', () => {
      const result = calculateAttendanceMetrics([
        { status: 'holiday' },
        { status: 'cancelled' },
      ]);
      expect(result.percentage).toBeNull();
      expect(result.hasData).toBe(false);
      expect(result.total).toBe(0);
      expect(result.cancelledOrHoliday).toBe(2);
    });

    it('rounds the percentage to the nearest integer (matches what the hero ring renders)', () => {
      // 1/3 = 33.33... → 33
      const result = calculateAttendanceMetrics([
        { status: 'present' },
        { status: 'absent' },
        { status: 'absent' },
      ]);
      expect(result.percentage).toBe(33);
    });

    it('handles 100% attendance correctly', () => {
      const result = calculateAttendanceMetrics([
        { status: 'present' },
        { status: 'present' },
        { status: 'exempt' },
      ]);
      expect(result.percentage).toBe(100);
      expect(result.hasData).toBe(true);
    });

    it('handles 0% attendance correctly (all absent, no exempt)', () => {
      const result = calculateAttendanceMetrics([
        { status: 'absent' },
        { status: 'absent' },
      ]);
      expect(result.percentage).toBe(0);
      expect(result.hasData).toBe(true);
    });
  });
});
