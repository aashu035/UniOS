import { creditsFromHours } from '../academic/logic';

/** What the AI scan returns per class (see core/ai/timetableParser.ts). */
export interface ScannedSession {
  day: string; startTime: string; endTime: string; subjectCode: string; type: 'theory' | 'lab' | 'tutorial'; venue?: string; faculty?: string;
}

type Part = 'theory' | 'lab' | 'tutorial';
export interface PlannedCourse {
  code: string;
  credits: number;
  components: Array<{ type: Part; durationMinutes: number; venueName?: string; facultyName?: string; sessions: Array<{ dayOfWeek: number; startTime: string; endTime: string }> }>;
}

const DAY: Record<string, number> = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
const DURATION: Record<Part, number> = { theory: 60, tutorial: 60, lab: 120 };
const pad = (n: number) => String(n).padStart(2, '0');

/**
 * "01:00 PM" / "1:00pm" / "13:00" → "13:00"; null when unreadable. The app stores
 * 24-hour times. With `collegeDay`, a bare 1:00–7:59 means afternoon, as on
 * printed Indian timetables ("1:00-1:55" is after lunch, never 1 AM).
 */
export function to24h(t: string, collegeDay = false): string | null {
  const m = /^\s*(\d{1,2})[:.](\d{2})\s*([AaPp])?\.?[Mm]?\.?\s*$/.exec(t ?? '');
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  const ap = m[3]?.toLowerCase();
  if (min > 59 || h > 23 || (ap && (h < 1 || h > 12))) return null;
  if (ap === 'p' && h !== 12) h += 12;
  if (ap === 'a' && h === 12) h = 0;
  if (!ap && collegeDay && h >= 1 && h <= 7) h += 12;
  return `${pad(h)}:${pad(min)}`;
}

/** Model output is untrusted: anything that is not a string counts as missing. */
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const dayNumber = (v: unknown): number | undefined => {
  const key = str(v).trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(DAY, key) ? DAY[key] : undefined; // not "constructor", "__proto__"
};

const mostCommon = (xs: unknown[]) => {
  const n = new Map<string, number>();
  for (const x of xs.map(str)) if (x.trim()) n.set(x.trim(), (n.get(x.trim()) ?? 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
};

/**
 * Group scanned classes into courses: every weekly slot kept (not just the first),
 * theory/lab/tutorial as separate parts, times in 24-hour form, credits from hours.
 * `sessions` comes straight from the model, so every field is checked here: a row
 * that breaks the schema is skipped with a warning, and the other rows still import.
 */
export function planImport(sessions: unknown): { courses: PlannedCourse[]; warnings: string[] } {
  const warnings: string[] = [];
  const byCode = new Map<string, Map<Part, ScannedSession[]>>();
  const rows: unknown[] = Array.isArray(sessions) ? sessions : [];
  if (!Array.isArray(sessions)) warnings.push("The scan didn't return a list of classes.");
  for (const raw of rows) {
    if (!raw || typeof raw !== 'object') { warnings.push('Skipped an unreadable row.'); continue; }
    const s = raw as ScannedSession;
    const code = str(s.subjectCode).trim().toUpperCase();
    if (!code) continue;
    const parts = byCode.get(code) ?? new Map<Part, ScannedSession[]>();
    const type: Part = s.type === 'lab' || s.type === 'tutorial' ? s.type : 'theory';
    parts.set(type, [...(parts.get(type) ?? []), s]);
    byCode.set(code, parts);
  }

  const courses: PlannedCourse[] = [];
  for (const [code, parts] of byCode) {
    // The app allows theory plus at most one of lab or tutorial.
    if (parts.has('lab') && parts.has('tutorial')) {
      warnings.push(`${code}: has both a lab and a tutorial; only the lab was added. Add the tutorial as a separate course if needed.`);
      parts.delete('tutorial');
    }
    if (!parts.has('theory')) warnings.push(`${code}: no lecture found, so the course has a lab/tutorial only. Add lecture slots if it has them.`);
    const components = (['theory', 'lab', 'tutorial'] as Part[]).filter((t) => t === 'theory' || parts.has(t)).map((type) => {
      const list = parts.get(type) ?? [];
      const seen = new Set<string>();
      const slots: PlannedCourse['components'][number]['sessions'] = [];
      for (const s of list) {
        const day = dayNumber(s.day);
        const start = to24h(str(s.startTime), true);
        const end = to24h(str(s.endTime), true);
        if (day === undefined || !start || !end || start >= end) { warnings.push(`${code}: skipped an unreadable slot (${str(s.day)} ${str(s.startTime)}–${str(s.endTime)}).`); continue; }
        const key = `${day}-${start}`;
        if (seen.has(key)) continue;
        seen.add(key);
        slots.push({ dayOfWeek: day, startTime: start, endTime: end });
      }
      slots.sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime));
      return { type, durationMinutes: DURATION[type], venueName: mostCommon(list.map((s) => s.venue)), facultyName: mostCommon(list.map((s) => s.faculty)), sessions: slots };
    });
    const hours = (t: Part) => (components.find((c) => c.type === t)?.sessions.length ?? 0) * DURATION[t] / 60;
    courses.push({ code, credits: creditsFromHours({ theory: hours('theory'), tutorial: hours('tutorial'), lab: hours('lab') }), components });
  }
  return { courses, warnings };
}
