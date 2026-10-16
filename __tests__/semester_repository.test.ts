/** Semester writes behind the Semesters screens, on the device driver. */
import { createDeviceDb } from '../testing/expoSqliteHarness';

const mockDevice: { db?: any; expoDb?: any } = {};
jest.mock('../core/db/client', () => ({
  get db() { return mockDevice.db; },
  get expoDb() { return mockDevice.expoDb; },
}));
const { SemesterRepository } = require('../domains/semester/repository');

let sqlite: any;
beforeEach(() => {
  const h = createDeviceDb();
  mockDevice.db = h.db; mockDevice.expoDb = h.expoDb; sqlite = h.sqlite;
  sqlite.exec(`
    INSERT INTO students (id, name, branch, current_semester) VALUES (1, 'Test Student', 'CSE', 5);
    INSERT INTO semesters (id, number, name, type, start_date, end_date, is_active, sgpa) VALUES
      (4, 4, NULL, 'even', '2026-01-12', '2026-05-22', 0, 8.12), (5, 5, NULL, 'odd', '2026-07-20', '2026-12-04', 1, NULL), (1, 1, NULL, 'odd', '2024-08-19', '2024-12-13', 0, NULL);
    INSERT INTO workspaces (id, semester_id, name, color, target_attendance) VALUES (1, 5, 'OS', '#000', 75), (2, 5, 'CN', '#000', 75), (3, 4, 'DS', '#000', 75);
  `);
});

it('lists semesters newest first with their course counts', async () => {
  const list = await SemesterRepository.listWithCourseCounts();
  expect(list.map((s: any) => [s.number, s.courses])).toEqual([[5, 2], [4, 1], [1, 0]]);
});

it('refuses a second semester with the same number, on add and on edit', async () => {
  await expect(SemesterRepository.addSemester({ number: 5, type: 'odd', startDate: '2027-01-01', endDate: '2027-05-01' })).rejects.toThrow('Semester 5 already exists');
  await expect(SemesterRepository.updateSemester(1, { number: 4 })).rejects.toThrow('Semester 4 already exists');
  const added = await SemesterRepository.addSemester({ number: 6, type: 'even', startDate: '2027-01-11', endDate: '2027-05-21', sgpa: null });
  expect(added).toMatchObject({ number: 6, isActive: false });
});

it('renumbering the active semester keeps the profile in step', async () => {
  await SemesterRepository.updateSemester(5, { number: 7 });
  expect(sqlite.prepare('SELECT current_semester AS n FROM students').get()).toEqual({ n: 7 });
});

it('a semester with courses cannot be deleted; an empty one can, and Undo brings it back', async () => {
  await expect(SemesterRepository.deleteSemester(5)).rejects.toThrow();
  const before = sqlite.prepare('SELECT * FROM semesters WHERE id = 1').get();
  const row = await SemesterRepository.deleteSemester(1);
  expect(sqlite.prepare('SELECT COUNT(*) AS n FROM semesters WHERE id = 1').get()).toEqual({ n: 0 });
  await SemesterRepository.restoreSemester(row);
  expect(sqlite.prepare('SELECT * FROM semesters WHERE id = 1').get()).toEqual(before);
});
