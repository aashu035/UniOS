/** Task writes behind the Add/Edit task screen, on the device driver. */
import { createDeviceDb } from '../testing/expoSqliteHarness';
import { addDays } from '../domains/academic/logic';
import { getLocalDateString } from '../core/utils/date';

const mockDevice: { db?: any; expoDb?: any } = {};
jest.mock('../core/db/client', () => ({
  get db() { return mockDevice.db; },
  get expoDb() { return mockDevice.expoDb; },
}));
const { TaskRepository } = require('../domains/task/repository');

let sqlite: any;
beforeEach(() => {
  const h = createDeviceDb();
  mockDevice.db = h.db; mockDevice.expoDb = h.expoDb; sqlite = h.sqlite;
  sqlite.exec(`
    INSERT INTO semesters (id, number, name, start_date, is_active) VALUES (1, 5, 'Sem 5', '2026-07-01', 1);
    INSERT INTO workspaces (id, semester_id, name, color, target_attendance) VALUES (1, 1, 'OS', '#000', 75), (2, 1, 'CN', '#000', 75);
    INSERT INTO tasks (id, workspace_id, title, type, due_date, priority, status, description) VALUES (7, 1, 'OS lab file', 'lab', '2026-11-02 23:59', 'high', 'pending', 'Experiment 6');
  `);
});
const row = (id: number) => sqlite.prepare('SELECT * FROM tasks WHERE id = ?').get(id);

it('Undo after delete puts back the same row with the same id', async () => {
  const before = row(7);
  const deleted = await TaskRepository.deleteTask(7);
  expect(row(7)).toBeUndefined();
  await TaskRepository.restoreTask(deleted);
  expect(row(7)).toEqual(before);
});

it('Undo is refused when the course was deleted meanwhile', async () => {
  const deleted = await TaskRepository.deleteTask(7);
  sqlite.exec('DELETE FROM workspaces WHERE id = 1');
  await expect(TaskRepository.restoreTask(deleted)).rejects.toThrow('Its course was deleted');
});

it('edit can move a task to another course or to General, but not to a missing course', async () => {
  await TaskRepository.updateTask(7, { workspaceId: 2 });
  expect(row(7).workspace_id).toBe(2);
  await TaskRepository.updateTask(7, { workspaceId: null, dueDate: null });
  expect(row(7)).toMatchObject({ workspace_id: null, due_date: null });
  await expect(TaskRepository.updateTask(7, { workspaceId: 99 })).rejects.toThrow('does not exist');
  expect(row(7).workspace_id).toBeNull();
});

it('a task due today with a time counts as due today', async () => {
  const today = getLocalDateString(new Date());
  sqlite.exec(`INSERT INTO tasks (id, title, due_date, status) VALUES (8, 'Quiz', '${today} 23:59', 'pending'), (9, 'Later', '${addDays(today, 1)} 08:00', 'pending')`);
  const due = (await TaskRepository.getTasksDueSoon()).map((t: any) => t.id);
  expect(due).toContain(8);
  expect(due).not.toContain(9);
});
