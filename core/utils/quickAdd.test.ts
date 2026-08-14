import { parseQuickAdd } from './quickAdd';

describe('parseQuickAdd', () => {
  it('parses type, location, and time correctly', () => {
    const result = parseQuickAdd('CSE Lab tomorrow 2pm in Lab 3');
    expect(result.type).toBe('lab');
    expect(result.location).toBe('Lab 3');
    expect(result.startTime).toBe('2:00 PM');
    expect(result.title).toBe('CSE');
  });

  it('parses just title and time', () => {
    const result = parseQuickAdd('Meeting with Bob 10:30am');
    expect(result.startTime).toBe('10:30 AM');
    expect(result.title).toBe('Meeting with Bob');
  });

  it('handles empty input', () => {
    const result = parseQuickAdd('');
    expect(result).toEqual({});
  });
});
