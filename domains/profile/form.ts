import { checkBranch, checkEnrollment, checkPersonName } from '../../core/utils/validate';

/** Profile, Edit profile and Semesters (design UniProfile, handoff §4–5). Pure helpers. */

export type ProfileDraft = { name: string; branch: string; enrollment: string; target: string };
export type ProfileErrors = Partial<Record<keyof ProfileDraft, string>>;
export type ProfileValues = { name: string; branch: string; enrollmentNo: string | null; targetCgpa: number | null };

/** "8", "8.5", "10", "9.25"; at most two decimals. */
const CGPA = /^\d{1,2}(\.\d{1,2})?$/;

/**
 * The app's rules (core/utils/validate.ts) with the design's short messages first:
 * "Enter your name" / "Check your name", "Enter your branch", "Check enrollment number", "Check target CGPA (0–10)".
 */
export function validateProfile(d: ProfileDraft): { errors: ProfileErrors; values: ProfileValues | null } {
  const errors: ProfileErrors = {};
  const n = checkPersonName(d.name);
  if (!n.ok) errors.name = d.name.trim() ? `Check your name. ${n.error}` : 'Enter your name';
  const b = checkBranch(d.branch, true);
  if (!b.ok) errors.branch = d.branch.trim() ? `Check your branch. ${b.error}` : 'Enter your branch';
  const e = checkEnrollment(d.enrollment);
  if (!e.ok) errors.enrollment = `Check enrollment number. ${e.error}`;
  const t = d.target.trim();
  const target = t === '' ? null : CGPA.test(t) ? Number(t) : NaN;
  if (target !== null && !(target >= 0 && target <= 10)) errors.target = 'Check target CGPA (0–10)';
  if (Object.keys(errors).length || !n.ok || !b.ok || !e.ok) return { errors, values: null };
  return { errors, values: { name: n.value, branch: b.value, enrollmentNo: e.value || null, targetCgpa: target } };
}

export function initials(name: string | null | undefined): string {
  return (name ?? '').trim().split(/\s+/).map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase() || '?';
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fd = (iso: string, year: boolean) => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MON[m - 1]}${year ? ` ${y}` : ''}`;
};

export type SemesterLike = { id: number; number: number; name: string | null; type: string | null; startDate: string | null; endDate: string | null; sgpa: number | null; isActive: boolean | null };

export const semesterTitle = (s: Pick<SemesterLike, 'number' | 'name'>) => (s.name?.trim() ? s.name.trim() : `Semester ${s.number}`);
export const termLabel = (type: string | null | undefined, number: number) => ((type ?? (number % 2 ? 'odd' : 'even')) === 'even' ? 'Even' : 'Odd');

/** "20 Jul – 4 Dec 2026"; the start year only shows when the years differ. Empty when a date is missing. */
export function semesterRange(start: string | null, end: string | null): string {
  if (!start || !end || !/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return '';
  return `${fd(start, start.slice(0, 4) !== end.slice(0, 4))} – ${fd(end, true)}`;
}

/** "Semester 5 · Odd · 20 Jul – 4 Dec 2026" for the profile card. */
export function semesterLine(s: SemesterLike): string {
  return [semesterTitle(s), termLabel(s.type, s.number), semesterRange(s.startDate, s.endDate)].filter(Boolean).join(' · ');
}

export type SemesterDraft = { id: number | null; number: string; name: string; term: 'odd' | 'even'; start: string; end: string; sgpa: string };
export type SemesterErrors = Partial<Record<'number' | 'dates' | 'sgpa', string>>;

export function validateSemester(d: SemesterDraft, existing: ReadonlyArray<Pick<SemesterLike, 'id' | 'number'>>) {
  const errors: SemesterErrors = {};
  const n = /^\d{1,2}$/.test(d.number.trim()) ? Number(d.number.trim()) : NaN;
  if (!(n >= 1 && n <= 12)) errors.number = 'Enter a semester number from 1 to 12';
  else if (existing.some((s) => s.number === n && s.id !== d.id)) errors.number = `Semester ${n} already exists`;
  if (!d.start || !d.end) errors.dates = 'Pick the start and end dates';
  else if (d.end <= d.start) errors.dates = 'The end date must be after the start date';
  const g = d.sgpa.trim();
  const sgpa = g === '' ? null : CGPA.test(g) ? Number(g) : NaN;
  if (sgpa !== null && !(sgpa >= 0 && sgpa <= 10)) errors.sgpa = 'SGPA must be between 0 and 10';
  const ok = !Object.keys(errors).length;
  return {
    errors,
    values: ok ? { number: n, name: d.name.trim() || null, type: d.term, startDate: d.start, endDate: d.end, sgpa } : null,
  };
}

/** Odd/Even follows the number until the user picks a term. */
export const termFor = (n: number): 'odd' | 'even' => (n % 2 === 0 ? 'even' : 'odd');

/** Onboarding branch chips (design UniOnboard): short label → the name stored on the profile. */
export const BRANCHES: ReadonlyArray<readonly [string, string]> = [
  ['CSE', 'B.Tech Computer Science & Engineering'],
  ['CSE (AI & ML)', 'B.Tech CSE (Artificial Intelligence & Machine Learning)'],
  ['ECE', 'B.Tech Electronics & Communication Engineering'],
  ['EE', 'B.Tech Electrical Engineering'],
  ['ME', 'B.Tech Mechanical Engineering'],
  ['CE', 'B.Tech Civil Engineering'],
  ['Other', ''],
];

export const branchValue = (chip: string, other: string) => (chip === 'Other' ? other.trim() : BRANCHES.find(([k]) => k === chip)?.[1] ?? '');

/**
 * Rough term dates for a semester number, so onboarding can fill them in:
 * odd semesters run 20 Jul – 4 Dec, even ones 15 Jan – 31 May, in the
 * academic year that holds `today` (July starts a new one).
 */
export function guessTermDates(n: number, today: string): { start: string; end: string } {
  const y = Number(today.slice(0, 4));
  const ayStart = Number(today.slice(5, 7)) >= 7 ? y : y - 1;
  return n % 2 ? { start: `${ayStart}-07-20`, end: `${ayStart}-12-04` } : { start: `${ayStart + 1}-01-15`, end: `${ayStart + 1}-05-31` };
}

export type OnboardDraft = { name: string; chip: string; other: string; number: number; start: string; end: string };

/** Step 1 (name, branch) and step 2 (semester, dates) of onboarding, with the design's messages. */
export function validateOnboarding(d: OnboardDraft) {
  const n = checkPersonName(d.name);
  const b = checkBranch(branchValue(d.chip, d.other), true);
  const name = n.ok ? null : d.name.trim() ? `Check your name. ${n.error}` : 'Enter your name';
  const branch = b.ok ? null : d.chip === 'Other' && d.other.trim() ? `Check your branch. ${b.error}` : 'Pick your branch';
  const number = d.number >= 1 && d.number <= 12 ? null : 'Pick your semester';
  const dates = !d.start || !d.end ? 'Add both dates' : d.end <= d.start ? 'The end date must be after the start date' : null;
  return {
    step1: { name, branch },
    step2: { number, dates },
    values: n.ok && b.ok && !number && !dates
      ? { name: n.value, branch: b.value, semester: { number: d.number, type: termFor(d.number), startDate: d.start, endDate: d.end } }
      : null,
  };
}
