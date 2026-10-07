import { checkBranch, checkCourseCode, checkCourseName, checkEnrollment, checkPersonName } from '../core/utils/validate';

const bad = (r: any) => !r.ok;
describe('input rules', () => {
  it('rejects the symbols that got into the profile', () => {
    expect(bad(checkPersonName('*-;₹"-'))).toBe(true);
    expect(bad(checkBranch('"!";:"'))).toBe(true);
    expect(bad(checkPersonName('   '))).toBe(true);
    expect(bad(checkPersonName('A'))).toBe(true);
    expect(bad(checkPersonName('Aashu123'))).toBe(true);
  });
  it('accepts real names in any script, and cleans spacing', () => {
    expect(checkPersonName('  Aashu   G ')).toEqual({ ok: true, value: 'Aashu G' });
    expect(checkPersonName("D'Souza-Mehta Jr.").ok).toBe(true);
    expect(checkPersonName('आशु शर्मा').ok).toBe(true);
    expect(checkPersonName('José').ok).toBe(true);
  });
  it('branch, enrollment, course name and code', () => {
    expect(checkBranch('Computer Science (AI & ML)').ok).toBe(true);
    expect(checkBranch('', false)).toEqual({ ok: true, value: '' });
    expect(checkEnrollment('24001001029')).toEqual({ ok: true, value: '24001001029' });
    expect(bad(checkEnrollment('12'))).toBe(true);
    expect(bad(checkEnrollment('24/00;1'))).toBe(true);
    expect(checkCourseName('Formal Languages & Automata Theory').ok).toBe(true);
    expect(bad(checkCourseName('***'))).toBe(true);
    expect(bad(checkCourseName('12345'))).toBe(true);
    expect(checkCourseCode(' pcaml303d ')).toEqual({ ok: true, value: 'PCAML303D' });
    expect(bad(checkCourseCode('3'))).toBe(true);
    expect(bad(checkCourseCode('₹₹'))).toBe(true);
  });
});
