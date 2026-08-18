export type QuickAddResult = {
  title?: string;
  type?: string;
  startDate?: string;
  startTime?: string;
  location?: string;
};

export function parseQuickAdd(input: string): QuickAddResult {
  const result: QuickAddResult = {};
  if (!input) return result;

  let remaining = input;

  // Extract type
  const typeMatch = remaining.match(/\b(lab|lecture|tutorial|exam|tute|seminar)\b/i);
  if (typeMatch) {
    result.type = typeMatch[1].toLowerCase();
    remaining = remaining.replace(typeMatch[0], '').trim();
  }

  // Extract location
  const locMatch = remaining.match(/\b(in|at)\s+([A-Za-z0-9\s-]+?)(?=\s+(tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}(:\d{2})?\s*(am|pm))|$)/i);
  if (locMatch) {
    result.location = locMatch[2].trim();
    remaining = remaining.replace(locMatch[0], '').trim();
  } else {
    // try matching at the end of the string
    const locEndMatch = remaining.match(/\b(in|at)\s+(.+)$/i);
    if (locEndMatch) {
      result.location = locEndMatch[2].trim();
      remaining = remaining.replace(locEndMatch[0], '').trim();
    }
  }

  // Extract time
  const timeMatch = remaining.match(/\b(\d{1,2}(:\d{2})?\s*(am|pm))\b/i);
  if (timeMatch) {
    let t = timeMatch[1].toUpperCase().replace(/\s+/g, ' ');
    // format to standard
    if (!t.includes(':')) {
       t = t.replace(/(AM|PM)/, ':00 $1');
    } else {
       t = t.replace(/(\d{1,2}:\d{2})\s*(AM|PM)/, '$1 $2');
    }
    result.startTime = t;
    remaining = remaining.replace(timeMatch[0], '').trim();
  }

  // Extract relative day
  const dayMatch = remaining.match(/\b(today|tomorrow)\b/i);
  if (dayMatch) {
    const today = new Date();
    if (dayMatch[1].toLowerCase() === 'tomorrow') {
      today.setDate(today.getDate() + 1);
    }
    result.startDate = today.toISOString().split('T')[0];
    remaining = remaining.replace(dayMatch[0], '').trim();
  }

  // Whatever is left is the title (clean up spaces and "on", "for")
  remaining = remaining.replace(/\b(on|for)\b/ig, '').replace(/\s+/g, ' ').trim();
  if (remaining.length > 0) {
    result.title = remaining;
  }

  return result;
}
