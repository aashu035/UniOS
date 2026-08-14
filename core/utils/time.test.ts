import { parseTime } from './time';

describe('time utils', () => {
  describe('parseTime', () => {
    it('parses AM times correctly', () => {
      expect(parseTime('10:30 AM')).toBe(10 * 60 + 30);
      expect(parseTime('12:15 AM')).toBe(15);
    });

    it('parses PM times correctly', () => {
      expect(parseTime('2:45 PM')).toBe(14 * 60 + 45);
      expect(parseTime('12:00 PM')).toBe(12 * 60);
    });

    it('handles invalid input gracefully', () => {
      expect(parseTime('invalid')).toBe(0);
    });
  });
});
