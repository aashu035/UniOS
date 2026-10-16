import { initials, semesterLine, semesterRange, semesterTitle, termFor, validateProfile, validateSemester } from '../domains/profile/form';

describe('profile form', () => {
  const ok = { name: 'Aanya Sharma', branch: 'B.Tech CSE', enrollment: '23001001018', target: '8.5' };
  it('accepts a valid profile and cleans it', () => {
    expect(validateProfile({ ...ok, name: '  Aanya   Sharma ', enrollment: '' })).toEqual({
      errors: {}, values: { name: 'Aanya Sharma', branch: 'B.Tech CSE', enrollmentNo: null, targetCgpa: 8.5 },
    });
    expect(validateProfile({ ...ok, target: '' }).values?.targetCgpa).toBeNull();
    expect(validateProfile({ ...ok, name: 'आशु शर्मा' }).values?.name).toBe('आशु शर्मा');
  });
  it('shows the design messages', () => {
    const r = validateProfile({ name: 'Aanya @Sharma', branch: '', enrollment: '23 001!', target: '11' });
    expect(r.values).toBeNull();
    expect(r.errors.name).toMatch(/^Check your name\./);
    expect(r.errors.branch).toBe('Enter your branch');
    expect(r.errors.enrollment).toMatch(/^Check enrollment number\./);
    expect(r.errors.target).toBe('Check target CGPA (0–10)');
    expect(validateProfile({ ...ok, name: '  ' }).errors.name).toBe('Enter your name');
    expect(validateProfile({ ...ok, target: '8.5x' }).errors.target).toBe('Check target CGPA (0–10)');
  });
  it('makes initials', () => {
    expect(initials('Aanya Sharma')).toBe('AS');
    expect(initials('  ')).toBe('?');
  });
});

describe('semesters', () => {
  const s = { id: 5, number: 5, name: null, type: 'odd', startDate: '2026-07-20', endDate: '2026-12-04', sgpa: null, isActive: true };
  it('formats titles and ranges', () => {
    expect(semesterTitle(s)).toBe('Semester 5');
    expect(semesterTitle({ ...s, name: 'Summer term' })).toBe('Summer term');
    expect(semesterRange('2026-07-20', '2026-12-04')).toBe('20 Jul – 4 Dec 2026');
    expect(semesterRange('2025-12-20', '2026-05-04')).toBe('20 Dec 2025 – 4 May 2026');
    expect(semesterRange(null, '2026-05-04')).toBe('');
    expect(semesterLine(s)).toBe('Semester 5 · Odd · 20 Jul – 4 Dec 2026');
    expect(termFor(4)).toBe('even');
  });
  it('validates the form', () => {
    const base = { id: null, number: '6', name: '', term: 'even' as const, start: '2027-01-11', end: '2027-05-21', sgpa: '' };
    const existing = [{ id: 5, number: 5 }];
    expect(validateSemester(base, existing)).toEqual({ errors: {}, values: { number: 6, name: null, type: 'even', startDate: '2027-01-11', endDate: '2027-05-21', sgpa: null } });
    expect(validateSemester({ ...base, number: '5' }, existing).errors.number).toBe('Semester 5 already exists');
    expect(validateSemester({ ...base, id: 5, number: '5' }, existing).errors.number).toBeUndefined();
    expect(validateSemester({ ...base, number: '13' }, existing).errors.number).toBe('Enter a semester number from 1 to 12');
    expect(validateSemester({ ...base, end: '2026-12-20' }, existing).errors.dates).toBe('The end date must be after the start date');
    expect(validateSemester({ ...base, start: '' }, existing).errors.dates).toBe('Pick the start and end dates');
    expect(validateSemester({ ...base, sgpa: '10.4' }, existing).errors.sgpa).toBe('SGPA must be between 0 and 10');
    expect(validateSemester({ ...base, sgpa: '8.12' }, existing).values?.sgpa).toBe(8.12);
  });
});

describe('onboarding form', () => {
  const { BRANCHES, branchValue, guessTermDates, validateOnboarding } = require('../domains/profile/form');
  const { checkBranch } = require('../core/utils/validate');
  const ok = { name: 'Aanya Sharma', chip: 'CSE', other: '', number: 5, start: '2026-07-20', end: '2026-12-04' };

  it('stores the full branch name, and every preset passes the branch check', () => {
    for (const [chip, full] of BRANCHES) if (chip !== 'Other') expect(checkBranch(full)).toEqual({ ok: true, value: full });
    expect(branchValue('CSE (AI & ML)', '')).toBe('B.Tech CSE (Artificial Intelligence & Machine Learning)');
    expect(branchValue('Other', '  B.Tech Biomedical Engineering ')).toBe('B.Tech Biomedical Engineering');
    expect(validateOnboarding(ok).values).toEqual({
      name: 'Aanya Sharma', branch: 'B.Tech Computer Science & Engineering',
      semester: { number: 5, type: 'odd', startDate: '2026-07-20', endDate: '2026-12-04' },
    });
  });

  it('uses the design messages for each step', () => {
    expect(validateOnboarding({ ...ok, name: '', chip: '' }).step1).toEqual({ name: 'Enter your name', branch: 'Pick your branch' });
    expect(validateOnboarding({ ...ok, name: 'A@nya' }).step1.name).toMatch(/^Check your name\. /);
    expect(validateOnboarding({ ...ok, chip: 'Other', other: '' }).step1.branch).toBe('Pick your branch');
    expect(validateOnboarding({ ...ok, chip: 'Other', other: '*-;' }).step1.branch).toMatch(/^Check your branch\. /);
    expect(validateOnboarding({ ...ok, number: 0 }).step2.number).toBe('Pick your semester');
    expect(validateOnboarding({ ...ok, end: '' }).step2.dates).toBe('Add both dates');
    expect(validateOnboarding({ ...ok, end: '2026-06-30' }).step2.dates).toBe('The end date must be after the start date');
    expect(validateOnboarding({ ...ok, end: ok.start }).values).toBeNull();
    expect(validateOnboarding({ ...ok, number: 6 }).values?.semester.type).toBe('even');
  });

  it('guesses term dates in the academic year that holds today', () => {
    expect(guessTermDates(5, '2026-10-16')).toEqual({ start: '2026-07-20', end: '2026-12-04' });
    expect(guessTermDates(6, '2026-10-16')).toEqual({ start: '2027-01-15', end: '2027-05-31' });
    expect(guessTermDates(6, '2027-02-03')).toEqual({ start: '2027-01-15', end: '2027-05-31' });
    expect(guessTermDates(5, '2027-02-03')).toEqual({ start: '2026-07-20', end: '2026-12-04' });
    expect(guessTermDates(1, '2026-07-01')).toEqual({ start: '2026-07-20', end: '2026-12-04' });
  });
});
