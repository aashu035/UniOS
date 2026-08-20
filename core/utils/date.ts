/**
 * Date utilities to ensure consistent local timezone handling
 * and prevent UTC offset slippage in calendar operations.
 */

/**
 * Returns the local date string for the provided Date object (or today if omitted)
 * in YYYY-MM-DD format.
 */
export function getLocalDateString(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Parses a YYYY-MM-DD string into a Date object at local midnight.
 */
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-');
  return new Date(Number(y), Number(m) - 1, Number(d), 0, 0, 0);
}

/**
 * Returns the local day of the week (0 = Sunday, 1 = Monday) for a given YYYY-MM-DD string.
 */
export function getLocalDayOfWeek(dateStr: string): number {
  return parseLocalDate(dateStr).getDay();
}

/**
 * Formats a 24-hour time string (HH:MM) into a 12-hour string with AM/PM.
 */
export function formatTime12Hour(time24: string): string {
  if (!time24) return '';
  const [h, m] = time24.split(':');
  if (!h || !m) return time24;
  let hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12;
  hour = hour ? hour : 12; 
  return `${hour}:${m} ${ampm}`;
}
