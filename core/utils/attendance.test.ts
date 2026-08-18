import { calculateAttendanceMetrics } from './attendance';

describe('attendance utils', () => {
  describe('calculateAttendanceMetrics', () => {
    it('calculates correct percentages and metrics', () => {
      const result = calculateAttendanceMetrics([
        { status: 'present' },
        { status: 'present' },
        { status: 'present' },
        { status: 'absent' },
        { status: 'absent' },
        { status: 'exempt' }
      ]);
      
      expect(result.present).toBe(4); // present (3) + exempt (1)
      expect(result.absent).toBe(2);
      expect(result.exempt).toBe(1);
      expect(result.total).toBe(6);
      expect(result.percentage).toBe(Math.round((4 / 6) * 100)); // 67%
    });

    it('handles empty records', () => {
      const result = calculateAttendanceMetrics([]);
      
      expect(result.percentage).toBeNull();
      expect(result.hasData).toBe(false);
      expect(result.total).toBe(0);
    });
  });
});
