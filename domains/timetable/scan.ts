import { checkCourseCode, checkCourseName } from '../../core/utils/validate';
import { clock, minutesOf, WEEKDAY_SHORT } from '../academic/logic';
import type { TakenSlot } from '../academic/setup';
import { planImport, to24h, type PlannedCourse } from '../workspace/importPlan';

/**
 * The AI timetable scan (design UniScan, handoff §8), as pure functions: check
 * what Gemini sent back, keep one group's classes, build the review cards, find
 * clashes with courses already in the app, and turn the reviewed classes into
 * courses to import. Everything from the model is untrusted input.
 */

export type Part = 'theory' | 'lab' | 'tutorial';
export type ScanClass = { id: string; code: string; part: Part; day: number; start: string; end: string; group: string | null; room: string; faculty: string };
export type ScanData = { classes: ScanClass[]; names: Record<string, string>; groups: string[]; warnings: string[] };

const DAY: Record<string, number> = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
const DAY_NAME = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const str = (v: unknown, max = 60): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const own = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

/** "cse 2", "CSE_2", "CSE–2" all mean CSE-2. */
export const normGroup = (g: string | null | undefined) => (g ?? '').toUpperCase().replace(/[\s_–—-]+/g, '-').replace(/^-+|-+$/g, '');

/** Check and clean the model's answer. Bad rows are skipped with a warning; the rest still import. */
export function readScan(raw: unknown): ScanData {
  const warnings: string[] = [];
  const obj = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const rows: unknown[] = Array.isArray(raw) ? raw : Array.isArray(obj.classes) ? obj.classes : [];
  const classes: ScanClass[] = [];
  const seen = new Set<string>();
  let unreadable = 0;
  for (const r of rows) {
    const s = r && typeof r === 'object' ? (r as Record<string, unknown>) : null;
    const code = s ? checkCourseCode(str(s.subjectCode, 30)) : null;
    const dayKey = s ? str(s.day).toLowerCase() : '';
    const day = own(DAY, dayKey) ? DAY[dayKey] : undefined;
    const start = s ? to24h(str(s.startTime), true) : null;
    const end = s ? to24h(str(s.endTime), true) : null;
    if (!s || !code?.ok || !code.value || day === undefined || !start || !end || start >= end) { unreadable++; continue; }
    const part: Part = s.type === 'lab' || s.type === 'tutorial' ? s.type : 'theory';
    const group = str(s.group, 20) || null;
    const key = `${code.value}|${part}|${day}|${start}|${normGroup(group)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    classes.push({ id: `c${classes.length}`, code: code.value, part, day, start, end, group, room: str(s.venue, 40), faculty: str(s.faculty, 40) });
  }
  if (unreadable) warnings.push(`Skipped ${unreadable} cell${unreadable === 1 ? '' : 's'} that couldn't be read.`);

  const names: Record<string, string> = {};
  for (const l of Array.isArray(obj.legend) ? obj.legend : []) {
    if (!l || typeof l !== 'object') continue;
    const code = checkCourseCode(str((l as any).code, 30));
    const name = checkCourseName(str((l as any).name, 100));
    if (code.ok && code.value && name.ok && !own(names, code.value)) names[code.value] = name.value;
  }

  const groups = new Map<string, string>();
  for (const g of [...(Array.isArray(obj.groups) ? obj.groups : []), ...classes.map((c) => c.group)]) {
    const v = str(g, 20);
    if (v && normGroup(v) && !groups.has(normGroup(v))) groups.set(normGroup(v), v);
  }
  return { classes, names, groups: [...groups.values()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).slice(0, 12), warnings };
}

/** Lectures for the whole section, plus this group's labs and tutorials. An empty group keeps everything. */
export function forGroup(classes: ScanClass[], group: string): ScanClass[] {
  const g = normGroup(group);
  return g ? classes.filter((c) => !c.group || normGroup(c.group) === g) : classes;
}

/** The usual length of one period in this timetable, from its lectures (60 min when there are none). */
export function periodMinutes(classes: ScanClass[]): number {
  const n = new Map<number, number>();
  for (const c of classes) if (c.part !== 'lab') { const d = minutesOf(c.end) - minutesOf(c.start); n.set(d, (n.get(d) ?? 0) + 1); }
  return [...n.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? 60;
}

const LABEL: Record<Part, [string, string]> = { theory: ['lecture', 'lectures'], lab: ['lab', 'labs'], tutorial: ['tutorial', 'tutorials'] };
export const PART_TITLE: Record<Part, string> = { theory: 'Lecture', lab: 'Lab', tutorial: 'Tutorial' };

/** "3 lectures · 1 lab". */
export function partSummary(classes: ScanClass[]): string {
  return (['theory', 'tutorial', 'lab'] as Part[])
    .map((p) => { const k = classes.filter((c) => c.part === p).length; return k ? `${k} ${LABEL[p][k === 1 ? 0 : 1]}` : ''; })
    .filter(Boolean).join(' · ');
}

/** "Mon 9:00", for the left column of a review row. */
export const rowTime = (c: ScanClass) => `${WEEKDAY_SHORT[c.day]} ${clock(c.start, false)}`;

/** "Lab · 2 periods · CSE-2 · JCB-213". */
export function rowDetail(c: ScanClass, period: number): string {
  const n = Math.round((minutesOf(c.end) - minutesOf(c.start)) / period);
  return [PART_TITLE[c.part], n > 1 ? `${n} periods` : '', c.group ?? '', c.room].filter(Boolean).join(' · ');
}

export type ReviewCourse = { code: string; name: string; classes: ScanClass[]; exists: boolean };

/** One card per course code, in code order. Codes already in the app are marked and won't import. */
export function reviewCourses(classes: ScanClass[], names: Record<string, string>, existingCodes: ReadonlySet<string>): ReviewCourse[] {
  const by = new Map<string, ScanClass[]>();
  for (const c of classes) by.set(c.code, [...(by.get(c.code) ?? []), c]);
  return [...by.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([code, list]) => ({
      code,
      name: names[code] ?? code,
      classes: list.sort((a, b) => a.day - b.day || a.start.localeCompare(b.start)),
      exists: existingCodes.has(code.toUpperCase()),
    }));
}

/** Classes that overlap a weekly slot of a course already in the app. They still import. */
export function clashesWith(classes: ScanClass[], taken: TakenSlot[]): Map<string, TakenSlot> {
  const out = new Map<string, TakenSlot>();
  for (const c of classes) {
    const t = taken.find((s) => s.dayOfWeek === c.day && minutesOf(c.start) < minutesOf(s.endTime) && minutesOf(s.startTime) < minutesOf(c.end));
    if (t) out.set(c.id, t);
  }
  return out;
}

/** "2 classes clash with your existing course Mathematics-III. They'll both show…" */
export function clashBanner(clashes: Map<string, TakenSlot>): string {
  const n = clashes.size;
  const courses = [...new Set([...clashes.values()].map((t) => t.name))];
  const list = courses.length === 1 ? courses[0] : `${courses.slice(0, -1).join(', ')} and ${courses[courses.length - 1]}`;
  return `${n} ${n === 1 ? 'class clashes' : 'classes clash'} with your existing course${courses.length === 1 ? '' : 's'} ${list}. They'll both show on the timetable. Tap a class to move it.`;
}

/** The reviewed courses (minus removed and existing ones) as courses to create, named from the legend. */
export function toPlan(courses: ReviewCourse[]): { courses: Array<PlannedCourse & { name: string }>; warnings: string[] } {
  const keep = courses.filter((c) => !c.exists && c.classes.length);
  const names = new Map(keep.map((c) => [c.code, c.name]));
  const r = planImport(keep.flatMap((c) => c.classes.map((x) => ({
    day: DAY_NAME[x.day], startTime: x.start, endTime: x.end, subjectCode: x.code, type: x.part, venue: x.room || undefined, faculty: x.faculty || undefined,
  }))));
  return { courses: r.courses.map((c) => ({ ...c, name: names.get(c.code) ?? c.code })), warnings: r.warnings };
}

/** Change a class's start or part in the edit sheet, keeping its length (or a lab's two periods). */
export function editClass(c: ScanClass, change: Partial<Pick<ScanClass, 'day' | 'start' | 'part' | 'room'>>, period: number): ScanClass {
  const next = { ...c, ...change };
  const len = change.part && change.part !== c.part ? period * (change.part === 'lab' ? 2 : 1) : minutesOf(c.end) - minutesOf(c.start);
  const endMin = Math.min(minutesOf(next.start) + len, 23 * 60 + 59);
  next.end = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
  return next;
}

// ─── Errors and the key ──────────────────────────────────────────────────────

export type ScanErrorKind = 'nokey' | 'rejected' | 'limit-day' | 'limit-minute' | 'unreadable' | 'offline' | 'cancelled' | 'other';

/** Thrown when the reply has no timetable in it (no grid, or a reply we can't parse). */
export class UnreadableTimetable extends Error {
  constructor() { super('No timetable found in the photo'); this.name = 'UnreadableTimetable'; }
}

const text = (e: unknown) => (e instanceof Error ? e.message : typeof e === 'string' ? e : e && typeof e === 'object' && typeof (e as any).message === 'string' ? (e as any).message : '');
const status = (e: unknown) => (e && typeof e === 'object' && 'status' in e ? Number((e as any).status) : undefined);

export function scanErrorKind(e: unknown): ScanErrorKind {
  const m = text(e);
  const s = status(e);
  if ((e as any)?.name === 'NoGeminiKey') return 'nokey';
  if (e instanceof UnreadableTimetable || (e as any)?.name === 'UnreadableTimetable') return 'unreadable';
  if ((e as any)?.name === 'AbortError' || /aborted|AbortError/i.test(m)) return 'cancelled';
  if ((s === 400 && /API.?KEY|API_KEY_INVALID/i.test(m)) || /API_KEY_INVALID|API key not valid/i.test(m) || s === 401 || s === 403 || /PERMISSION_DENIED/i.test(m)) return 'rejected';
  if (s === 429 || /RESOURCE_EXHAUSTED|quota/i.test(m)) return /PerDay/i.test(m) ? 'limit-day' : 'limit-minute';
  if (/Network request failed|fetch failed|ENOTFOUND|ECONNRESET|timed? ?out|offline|internet/i.test(m)) return 'offline';
  return 'other';
}

const GEMINI_KEY_FORMAT = /^AIza[0-9A-Za-z_-]{35}$/;
export const isGeminiKey = (k: string) => GEMINI_KEY_FORMAT.test(k.trim());
/** "AIza••••••••••••7Qx": enough to recognise the key, not enough to use it. */
export const maskKey = (k: string) => (k.length > 7 ? `${k.slice(0, 4)}${'•'.repeat(12)}${k.slice(-3)}` : '•'.repeat(12));

/** Pacific time's offset from UTC in hours at an instant: 7 in summer time, 8 otherwise (US rules). */
function pacificOffset(utcMs: number): number {
  const y = new Date(utcMs).getUTCFullYear();
  const sunday = (m: number, n: number) => { const first = new Date(Date.UTC(y, m, 1)).getUTCDay(); return 1 + ((7 - first) % 7) + 7 * (n - 1); };
  const start = Date.UTC(y, 2, sunday(2, 2), 10); // second Sunday of March, 2 AM PST
  const end = Date.UTC(y, 10, sunday(10, 1), 9); // first Sunday of November, 2 AM PDT
  return utcMs >= start && utcMs < end ? 7 : 8;
}

/** Gemini's free daily quota resets at midnight Pacific time. The next reset after `now`. */
export function quotaReset(now: Date): Date {
  const off = pacificOffset(now.getTime());
  const wall = new Date(now.getTime() - off * 3600e3); // Pacific wall clock in UTC fields
  const nextMidnight = Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate() + 1);
  return new Date(nextMidnight + pacificOffset(nextMidnight + off * 3600e3) * 3600e3);
}

/** "12:30 PM" or "tomorrow at 12:30 PM", in the phone's time zone. */
export function quotaResetLabel(now: Date): string {
  const r = quotaReset(now);
  const t = clock(`${r.getHours()}:${String(r.getMinutes()).padStart(2, '0')}`);
  return r.toDateString() === now.toDateString() ? t : `tomorrow at ${t}`;
}
