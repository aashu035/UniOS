/**
 * Inputs the app does not control: shared backup files, deep links, rows that
 * came from either. The native file layer percent-decodes paths and resolves
 * "." and "SQLite" against the app's private folder, so these names must never
 * reach a file operation. Found by the October security review.
 */
import { createDeviceDb } from '../testing/expoSqliteHarness';
import { isAppRoute, isOwnAvatar, isStoredUpload, isWebLink } from '../core/fs/names';

const mockDevice: { db?: any; expoDb?: any } = {};
jest.mock('../core/db/client', () => ({
  get db() { return mockDevice.db; },
  get expoDb() { return mockDevice.expoDb; },
}));
const mockDeleted: string[] = [];
jest.mock('../core/fs/FileManager', () => ({ FileManager: { deleteFile: async (f: string) => { mockDeleted.push(f); } } }));

const { ResourceRepository } = require('../domains/resource/repository');
const { WorkspaceRepository } = require('../domains/workspace/repository');
const { exportBackup, importBackup } = require('../core/db/backup');

const UPLOAD = '3f2b8c1e-9d4a-4e7b-8c2d-1a2b3c4d5e6f.pdf';
const HOSTILE = [
  '.', '..', '%2E', '%2E%2E', '%2E%2E%2FSQLite%2Funios.db', '%252E%252E%252FSQLite', 'SQLite', 'resources',
  '../SQLite/unios.db', '/data/user/0/x', 'file:///data/user/0/x', `${UPLOAD}/../../SQLite`, `${UPLOAD.slice(0, -4)}.%2E%2E`,
  '', ' ', null, undefined, 42,
];

describe('only names the app writes count as its files', () => {
  it.each(HOSTILE)('rejects %p as an upload and as an avatar', (name) => {
    expect(isStoredUpload(name)).toBe(false);
    expect(isOwnAvatar(name)).toBe(false);
  });

  it('accepts real upload names, including odd extensions from the original file', () => {
    for (const n of [UPLOAD, UPLOAD.replace('.pdf', '.PDF'), UPLOAD.replace('.pdf', '.My Notes'), UPLOAD.replace('.pdf', '.jpeg')]) {
      expect(isStoredUpload(n)).toBe(true);
    }
    expect(isOwnAvatar('avatar_1791360000000.jpg')).toBe(true);
    expect(isOwnAvatar('avatar_1.jpg.png')).toBe(false);
  });

  it('only http(s) links and in-app routes pass as links', () => {
    expect(isWebLink('https://example.com/syllabus')).toBe(true);
    for (const l of ['intent://x#Intent;end', 'file:///sdcard/x', 'content://x', 'javascript:alert(1)', 'mailto:a@b']) expect(isWebLink(l)).toBe(false);
    expect(isAppRoute('/course/3')).toBe(true);
    for (const r of ['//evil.example/login', 'https://evil.example', 'unios://x', 'course/3', '/a b']) expect(isAppRoute(r)).toBe(false);
  });
});

describe('a hostile uri in the database never reaches a delete', () => {
  beforeEach(() => {
    const h = createDeviceDb();
    mockDevice.db = h.db; mockDevice.expoDb = h.expoDb;
    mockDeleted.length = 0;
    h.sqlite.exec(`
      INSERT INTO semesters (id, number, name, start_date, is_active) VALUES (1, 5, 'Sem 5', '2026-07-01', 1);
      INSERT INTO workspaces (id, semester_id, name, color, target_attendance) VALUES (1, 1, 'Planted', '#000', 75);
      INSERT INTO resources (workspace_id, title, type, uri) VALUES (1, 'Unit 1', 'file', '.'), (1, 'Unit 2', 'file', '%2E'),
        (1, 'Unit 3', 'file', 'SQLite'), (1, 'Unit 4', 'file', '%2E%2E%2FSQLite%2Funios.db'), (1, 'Real', 'file', '${UPLOAD}');
    `);
  });

  it('deleting the course deletes only the real upload', async () => {
    await WorkspaceRepository.deleteWorkspace(1);
    expect(mockDeleted).toEqual([UPLOAD]);
  });

  it('removeFileIfUnused ignores every hostile name', async () => {
    for (const n of HOSTILE) await ResourceRepository.removeFileIfUnused(n as any);
    expect(mockDeleted).toEqual([]);
  });
});

describe('restoring a shared backup clears paths and links the app did not write', () => {
  let sqlite: any;
  beforeEach(() => {
    const h = createDeviceDb();
    mockDevice.db = h.db; mockDevice.expoDb = h.expoDb; sqlite = h.sqlite;
    sqlite.exec(`
      INSERT INTO students (id, name, branch, current_semester, hero_portrait_uri) VALUES (1, 'Me', 'CSE', 5, 'avatar_1791360000000.jpg');
      INSERT INTO semesters (id, number, name, start_date, is_active) VALUES (1, 5, 'Sem 5', '2026-07-01', 1);
      INSERT INTO workspaces (id, semester_id, name, color, target_attendance) VALUES (1, 1, 'OS', '#000', 75);
      INSERT INTO resources (id, workspace_id, title, type, uri) VALUES (1, 1, 'Real file', 'file', '${UPLOAD}'), (2, 1, 'Syllabus', 'link', 'https://example.com/s');
      INSERT INTO notifications (id, type, title, message, action_url) VALUES (1, 'info', 'Open OS', 'Tap to open', '/course/1');
    `);
  });

  it('keeps values the app wrote', async () => {
    await importBackup(await exportBackup());
    expect(sqlite.prepare('SELECT hero_portrait_uri AS a FROM students').get().a).toBe('avatar_1791360000000.jpg');
    expect(sqlite.prepare('SELECT uri FROM resources ORDER BY id').all().map((r: any) => r.uri)).toEqual([UPLOAD, 'https://example.com/s']);
    expect(sqlite.prepare('SELECT action_url AS u FROM notifications').get().u).toBe('/course/1');
  });

  it('clears a planted avatar path, file path, web avatar and phishing link', async () => {
    const b = JSON.parse(await exportBackup());
    b.tables.students[0].heroPortraitUri = 'SQLite';
    b.tables.resources[0].uri = '.';
    b.tables.resources[1].uri = 'intent://x#Intent;package=evil;end';
    b.tables.notifications[0].actionUrl = 'https://samarth-login.example/login';
    await importBackup(JSON.stringify(b));
    expect(sqlite.prepare('SELECT hero_portrait_uri AS a FROM students').get().a).toBeNull();
    expect(sqlite.prepare('SELECT uri FROM resources ORDER BY id').all().map((r: any) => r.uri)).toEqual([null, null]);
    expect(sqlite.prepare('SELECT action_url AS u FROM notifications').get().u).toBeNull();

    const web = JSON.parse(await exportBackup());
    web.tables.students[0].heroPortraitUri = 'https://tracker.example/pixel.jpg';
    await importBackup(JSON.stringify(web));
    expect(sqlite.prepare('SELECT hero_portrait_uri AS a FROM students').get().a).toBeNull();
  });
});
