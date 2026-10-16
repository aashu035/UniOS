/** Onboarding's save: the student and the active semester in one transaction, on the device driver. */
import { createDeviceDb } from '../testing/expoSqliteHarness';

const mockDevice: { db?: any; expoDb?: any } = {};
jest.mock('../core/db/client', () => ({
  get db() { return mockDevice.db; },
  get expoDb() { return mockDevice.expoDb; },
}));
const { ProfileRepository } = require('../domains/profile/repository');

let sqlite: any;
beforeEach(() => {
  const h = createDeviceDb();
  mockDevice.db = h.db; mockDevice.expoDb = h.expoDb; sqlite = h.sqlite;
});

const data = { name: 'Aanya Sharma', branch: 'B.Tech Computer Science & Engineering', semester: { number: 5, type: 'odd', startDate: '2026-07-20', endDate: '2026-12-04' } };
const rows = () => ({
  students: sqlite.prepare('SELECT name, branch, current_semester FROM students').all(),
  semesters: sqlite.prepare('SELECT number, type, start_date, end_date, is_active FROM semesters ORDER BY number').all(),
});

it('creates the student and the active semester with its dates', async () => {
  await ProfileRepository.completeOnboarding(data);
  expect(rows()).toEqual({
    students: [{ name: 'Aanya Sharma', branch: 'B.Tech Computer Science & Engineering', current_semester: 5 }],
    semesters: [{ number: 5, type: 'odd', start_date: '2026-07-20', end_date: '2026-12-04', is_active: 1 }],
  });
});

it('running it twice updates the same rows instead of adding more', async () => {
  await ProfileRepository.completeOnboarding(data);
  await ProfileRepository.completeOnboarding({ ...data, name: 'Aanya S', semester: { ...data.semester, number: 6, type: 'even', startDate: '2027-01-15', endDate: '2027-05-31' } });
  const r = rows();
  expect(r.students).toEqual([{ name: 'Aanya S', branch: data.branch, current_semester: 6 }]);
  expect(r.semesters.map((s: any) => [s.number, s.is_active])).toEqual([[5, 0], [6, 1]]);
});

it('reuses a semester with the same number and leaves only it active', async () => {
  sqlite.exec(`INSERT INTO semesters (number, type, is_active) VALUES (5, 'odd', 0), (3, 'odd', 1)`);
  await ProfileRepository.completeOnboarding(data);
  expect(rows().semesters).toEqual([
    { number: 3, type: 'odd', start_date: null, end_date: null, is_active: 0 },
    { number: 5, type: 'odd', start_date: '2026-07-20', end_date: '2026-12-04', is_active: 1 },
  ]);
});

it('saves nothing when a write fails', async () => {
  sqlite.exec(`CREATE TRIGGER no_students BEFORE INSERT ON students BEGIN SELECT RAISE(ABORT, 'disk full'); END;`);
  await expect(ProfileRepository.completeOnboarding(data)).rejects.toThrow('disk full');
  expect(rows()).toEqual({ students: [], semesters: [] });
});
