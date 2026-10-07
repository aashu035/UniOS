/**
 * Input rules for names and codes people type. Each returns the cleaned value or
 * a message to show. Letters include Latin accents and Devanagari, so "Aashu",
 * "José" and "आशु" are fine; symbol-only text like *-;₹"- is not.
 */
export type Checked = { ok: true; value: string } | { ok: false; error: string };

const LETTER = 'A-Za-z\\u00C0-\\u024F\\u0900-\\u097F';
const hasLetters = (s: string, n = 1) => (s.match(new RegExp(`[${LETTER}]`, 'g')) ?? []).length >= n;
const clean = (s: string) => (s ?? '').replace(/\s+/g, ' ').trim();

export function checkPersonName(raw: string): Checked {
  const v = clean(raw);
  if (!v) return { ok: false, error: 'Enter your name.' };
  if (v.length > 60) return { ok: false, error: 'Keep the name under 60 characters.' };
  if (!new RegExp(`^[${LETTER}][${LETTER}\\u0900-\\u097F .'-]*$`).test(v) || !hasLetters(v, 2)) {
    return { ok: false, error: 'Use letters only (spaces, dots, hyphens and apostrophes are fine).' };
  }
  return { ok: true, value: v };
}

export function checkBranch(raw: string, required = true): Checked {
  const v = clean(raw);
  if (!v) return required ? { ok: false, error: 'Enter your branch, e.g. Computer Science.' } : { ok: true, value: '' };
  if (v.length > 60) return { ok: false, error: 'Keep the branch under 60 characters.' };
  if (!new RegExp(`^[${LETTER}0-9 &().,/+-]+$`).test(v) || !hasLetters(v, 2)) {
    return { ok: false, error: 'Use letters and numbers, e.g. "CSE" or "Computer Science (AI & ML)".' };
  }
  return { ok: true, value: v };
}

export function checkEnrollment(raw: string): Checked {
  const v = clean(raw).toUpperCase();
  if (!v) return { ok: true, value: '' };
  if (!/^[A-Z0-9][A-Z0-9/-]{2,19}$/.test(v)) return { ok: false, error: 'Use 3–20 letters, numbers, "/" or "-".' };
  return { ok: true, value: v };
}

export function checkCourseName(raw: string): Checked {
  const v = clean(raw);
  if (!v) return { ok: false, error: 'Give the course a name.' };
  if (v.length > 100) return { ok: false, error: 'Keep the name under 100 characters.' };
  if (!new RegExp(`^[${LETTER}0-9 &().,:/+'-]+$`).test(v) || !hasLetters(v, 2)) {
    return { ok: false, error: 'Use letters and numbers, e.g. "Soft Computing Techniques".' };
  }
  return { ok: true, value: v };
}

export function checkCourseCode(raw: string): Checked {
  const v = clean(raw).toUpperCase().replace(/\s+/g, '');
  if (!v) return { ok: true, value: '' };
  if (!/^[A-Z0-9][A-Z0-9-]{1,14}$/.test(v) || !/[A-Z]/.test(v)) return { ok: false, error: 'Codes look like PCAML303D or CSE-301.' };
  return { ok: true, value: v };
}
