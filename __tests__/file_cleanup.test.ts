import Database from 'better-sqlite3';
import path from 'path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '../core/db/schema';

// Deleting a course used to leave its uploaded files on the phone: the cleanup
// called a file API that throws on SDK 56, and looked for `file://` paths while
// uploads are stored as bare filenames.

const sqlite = new Database(':memory:');
sqlite.pragma('foreign_keys = OFF');
const mockDb = drizzle(sqlite, { schema });
migrate(mockDb, { migrationsFolder: path.join(__dirname, '../drizzle') });
sqlite.pragma('foreign_keys = ON');

jest.mock('../core/db/client', () => ({ db: mockDb, expoDb: {} }));
const deleted: string[] = [];
jest.mock('../core/fs/FileManager', () => ({ FileManager: { deleteFile: async (f: string) => { deleted.push(f); } } }));

const { WorkspaceRepository } = require('../domains/workspace/repository');
const { ResourceRepository } = require('../domains/resource/repository');

beforeEach(() => {
  deleted.length = 0;
  sqlite.exec(`
    DELETE FROM resources; DELETE FROM workspaces; DELETE FROM semesters;
    INSERT INTO semesters (id, number, name, start_date, is_active) VALUES (1, 5, 'Sem 5', '2026-07-01', 1);
    INSERT INTO workspaces (id, semester_id, name, color, target_attendance) VALUES (1, 1, 'OS', '#000', 75), (2, 1, 'DBMS', '#000', 75);
    INSERT INTO resources (id, workspace_id, title, type, uri) VALUES
      (1, 1, 'Unit 1', 'file', 'a1.pdf'),
      (2, 1, 'Shared notes', 'file', 'shared.pdf'),
      (3, 2, 'Same notes, other course', 'file', 'shared.pdf'),
      (4, 1, 'Syllabus link', 'link', 'https://example.com/syllabus'),
      (5, NULL, 'General file', 'file', 'g1.pdf');
  `);
});

it('deleting a course removes its files, but not one another course still uses', async () => {
  await WorkspaceRepository.deleteWorkspace(1);
  expect(deleted).toEqual(['a1.pdf']);
  const left = sqlite.prepare('SELECT id FROM resources ORDER BY id').all().map((r: any) => r.id);
  expect(left).toEqual([3, 5]);
});

it('deleting the last row that uses a shared file removes the file', async () => {
  await ResourceRepository.deleteResource(2);
  expect(deleted).toEqual([]);
  await ResourceRepository.deleteResource(3);
  expect(deleted).toEqual(['shared.pdf']);
});

it('never touches links or paths that are not stored uploads', async () => {
  await ResourceRepository.deleteResource(4);
  await ResourceRepository.removeFileIfUnused('../../etc/passwd');
  await ResourceRepository.removeFileIfUnused('file:///data/user/0/x.pdf');
  await ResourceRepository.removeFileIfUnused(null);
  expect(deleted).toEqual([]);
});
