/**
 * Parses a time string (e.g. "02:00 PM", "2:00PM", "14:00") into minutes since midnight.
 * This provides a robust, centralized way to sort and compare times.
 */
export function parseTime(timeStr: string): number {
  if (!timeStr) return 0;
  
  const normalized = timeStr.trim().toLowerCase();
  
  // Handle 12-hour format with AM/PM
  const match12 = normalized.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const minutes = match12[2] ? parseInt(match12[2], 10) : 0;
    const isPM = match12[3] === 'pm';
    
    if (hours === 12) {
      hours = isPM ? 12 : 0;
    } else if (isPM) {
      hours += 12;
    }
    
    return hours * 60 + minutes;
  }
  
  // Handle 24-hour format
  const match24 = normalized.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    const hours = parseInt(match24[1], 10);
    const minutes = parseInt(match24[2], 10);
    return hours * 60 + minutes;
  }
  
  // Fallback
  return 0;
}

/**
 * Compares two time strings for sorting (ascending).
 */
export function compareTimeStrings(a: string, b: string): number {
  return parseTime(a) - parseTime(b);
}
