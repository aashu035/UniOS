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
      
      expect(result.present).toBe(3);
      expect(result.absent).toBe(2);
      expect(result.exempt).toBe(1);
      expect(result.total).toBe(6);
      expect(result.percentage).toBe(Math.round((4 / 6) * 100)); // present + exempt
    });

    it('handles empty records', () => {
      const result = calculateAttendanceMetrics([]);
      
      expect(result.percentage).toBe(100);
      expect(result.total).toBe(0);
    });
  });
});
