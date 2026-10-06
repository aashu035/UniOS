/**
 * Reads the text of printed college timetables, cell by cell, into classes for
 * one student. Pure and deterministic: whatever produced the text (on-device OCR,
 * Gemini asked only to transcribe, a shared file, or typing) gets the same rules.
 *
 * Cell grammar, from the DCRUST B.Tech timetables (comma/space/line separated):
 *   E1..E10, P1..P8        slot codes, meaningless to students: ignored
 *   ES-L / ES-T            course code + Lecture (theory) / Tutorial
 *   ES Lab                 course code + Lab (the first "<X> Lab" whose X is a course)
 *   CSE-1, CSE-2, CSE-3    group; a class names its group only when split by group
 *   JCB-213, CVR-210A      venue; also "RS Lab", "MT Lab" (named labs after the subject)
 *   VF-3, NV, KR, AS       faculty code
 * A cell that names groups applies only to those groups. A cell with a class and
 * no group applies to the whole section. A split slot where the student's group
 * isn't named is free time for them.
 */

export type ClassType = 'theory' | 'lab' | 'tutorial';

export interface CourseInfo { abbr: string; name: string; code?: string }

/** One cell (or one line of a split cell) as printed, with the periods it spans. */
export interface CellText { day: number; fromPeriod: number; toPeriod: number; text: string }

export interface ParsedCell {
  course: string | null; // abbreviation, e.g. "SC"
  type: ClassType | null;
  groups: string[]; // e.g. ["CSE-2"]; empty = whole section
  venue: string | null;
  faculty: string[];
  unknown: string[]; // tokens the rules could not place, shown to the user for review
}

export interface Period { start: string; end: string }

export interface ResolvedClass {
  day: number; // 1 = Monday
  start: string;
  end: string;
  course: string;
  courseName?: string;
  courseCode?: string;
  type: ClassType;
  venue: string | null;
  faculty: string[];
  /** Set when the rules had to guess; the review screen highlights these. */
  doubt?: string;
}

const SLOT_CODE = /^[EP]\d{1,2}$/i;
const VENUE = /^[A-Z]{2,5}-?\d{2,4}[A-Z]?$/i;
const SUBJECT = /^([A-Z]{2,5})-(L|T|P)$/i;

/** "ES – Embedded Systems (ESECE301D)" lines from the legend under the grid. */
export function parseLegend(text: string): CourseInfo[] {
  const out: CourseInfo[] = [];
  const re = /\b([A-Z]{2,5})\s*[–—-]\s*([A-Za-z][A-Za-z &,.'/]+?)\s*(?:\(([A-Z0-9]{5,12})\))?(?=\s{2,}|\s+[A-Z]{2,5}\s*[–—-]\s|$|\n)/g;
  for (const line of text.split(/\n/)) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(line))) out.push({ abbr: m[1].toUpperCase(), name: m[2].trim().replace(/\s+/g, ' '), ...(m[3] ? { code: m[3] } : {}) });
  }
  return out;
}

/** The group family from the student's own group: "CSE-2" → "CSE". */
export const groupPrefix = (group: string) => (/^([A-Z]+)-?\d+$/i.exec(group.trim())?.[1] ?? '').toUpperCase();

const tokenize = (text: string) => text.replace(/[\n,;]+/g, ' ').split(/\s+/).map((t) => t.trim()).filter(Boolean);

export function parseCell(text: string, ctx: { courses: Set<string>; groupPrefix: string }): ParsedCell {
  const cell: ParsedCell = { course: null, type: null, groups: [], venue: null, faculty: [], unknown: [] };
  const toks = tokenize(text);
  const isGroup = (t: string) => !!ctx.groupPrefix && new RegExp(`^${ctx.groupPrefix}-?\\d+$`, 'i').test(t);
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    const next = toks[i + 1];
    const up = t.toUpperCase();
    if (SLOT_CODE.test(t)) continue;
    const sub = SUBJECT.exec(t);
    if (sub && !cell.course) {
      cell.course = sub[1].toUpperCase();
      cell.type = sub[2].toUpperCase() === 'T' ? 'tutorial' : sub[2].toUpperCase() === 'P' ? 'lab' : 'theory';
      continue;
    }
    if (next && /^lab$/i.test(next)) {
      // "<X> Lab": the subject if X is a course and none found yet, else a named lab venue.
      if (!cell.course && (ctx.courses.has(up) || ctx.courses.size === 0)) { cell.course = up; cell.type = 'lab'; }
      else if (!cell.venue) cell.venue = `${t} Lab`;
      else cell.unknown.push(`${t} Lab`);
      i++;
      continue;
    }
    if (isGroup(t)) { cell.groups.push(up.replace(/^([A-Z]+)-?(\d+)$/, '$1-$2')); continue; }
    if (VENUE.test(t) && /\d{2,}/.test(t)) { if (!cell.venue) cell.venue = up.replace(/^([A-Z]+)(\d)/, '$1-$2'); else cell.unknown.push(t); continue; }
    if (/^[A-Z]{1,4}-?\d{1,2}$/i.test(t) || /^[A-Z]{2,3}$/.test(t)) {
      if (!cell.course && ctx.courses.has(up)) { cell.unknown.push(t); continue; } // a bare course code with no L/T/Lab
      cell.faculty.push(up);
      continue;
    }
    cell.unknown.push(t);
  }
  return cell;
}

/**
 * Turn the cells of a whole timetable into one student's weekly classes.
 * `periods[n - 1]` holds the times of period n.
 */
export function resolveTimetable(
  cells: CellText[],
  opts: { periods: Period[]; group: string; legend?: CourseInfo[] },
): ResolvedClass[] {
  const legend = new Map((opts.legend ?? []).map((c) => [c.abbr, c]));
  const ctx = { courses: new Set(legend.keys()), groupPrefix: groupPrefix(opts.group) };
  const mine = opts.group.toUpperCase().replace(/^([A-Z]+)-?(\d+)$/, '$1-$2');
  const out: ResolvedClass[] = [];
  for (const c of cells) {
    const p = parseCell(c.text, ctx);
    if (!p.course || !p.type) continue; // empty, slot codes only, or a free line of a split slot
    if (p.groups.length && !p.groups.includes(mine)) continue; // another group's class
    const from = opts.periods[c.fromPeriod - 1];
    const to = opts.periods[c.toPeriod - 1];
    if (!from || !to) continue;
    const info = legend.get(p.course);
    const doubt = [
      ctx.courses.size && !info ? `"${p.course}" is not in the legend` : null,
      p.unknown.length ? `Couldn't place: ${p.unknown.join(' ')}` : null,
      !p.groups.length && p.type === 'lab' ? 'Lab with no group named: assumed for everyone' : null,
    ].filter(Boolean).join('. ');
    out.push({
      day: c.day, start: from.start, end: to.end, course: p.course, type: p.type, venue: p.venue, faculty: p.faculty,
      ...(info ? { courseName: info.name, ...(info.code ? { courseCode: info.code } : {}) } : {}),
      ...(doubt ? { doubt } : {}),
    });
  }
  // Same course, type and room in back-to-back periods (a lab printed as two cells) is one class.
  out.sort((a, b) => a.day - b.day || a.start.localeCompare(b.start));
  const merged: ResolvedClass[] = [];
  for (const c of out) {
    const prev = merged[merged.length - 1];
    if (prev && prev.day === c.day && prev.course === c.course && prev.type === c.type && prev.type === 'lab' && minutes(c.start) - minutes(prev.end) <= 10) {
      prev.end = c.end;
      continue;
    }
    merged.push(c);
  }
  return merged;
}

const minutes = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

/** Hourly periods with a 5-minute gap, as on the DCRUST timetable: 8:00–8:55 … 5:00–5:55. */
export function hourlyPeriods(firstHour: number, count: number, lengthMin = 55): Period[] {
  const pad = (n: number) => String(n).padStart(2, '0');
  return Array.from({ length: count }, (_, i) => ({ start: `${pad(firstHour + i)}:00`, end: `${pad(firstHour + i)}:${pad(lengthMin)}` }));
}
