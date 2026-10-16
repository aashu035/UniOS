/** The copy job behind + Add, and the resource writes it uses, on the device driver. */
import { createDeviceDb } from '../testing/expoSqliteHarness';

const mockDevice: { db?: any; expoDb?: any } = {};
jest.mock('../core/db/client', () => ({
  get db() { return mockDevice.db; },
  get expoDb() { return mockDevice.expoDb; },
}));
const mockFiles = new Set<string>(); // stored names that exist on the "phone"
const mockSaves: Array<{ uri: string; existing?: string }> = [];
const mockFail = new Set<string>();
jest.mock('../core/fs/FileManager', () => ({
  FileManager: {
    generateFileHash: jest.fn(async (uri: string) => `hash-of-${uri}`),
    getAbsolutePath: (n: string) => `/docs/resources/${n}`,
    saveFile: jest.fn(async (uri: string, ext: string, existing?: string, hash?: string) => {
      if (mockFail.has(uri)) throw new Error('copy failed');
      mockSaves.push({ uri, existing });
      const filename = existing ?? `0000000${mockSaves.length}-0000-4000-8000-000000000000.${ext}`;
      mockFiles.add(filename);
      return { filename, hash: hash ?? `hash-of-${uri}`, sizeBytes: 100 };
    }),
    deleteFile: jest.fn(async (n: string) => { mockFiles.delete(n); }),
  },
}));
jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  getInfoAsync: jest.fn(async (p: string) => ({ exists: mockFiles.has(p.split('/').pop()!) })),
  deleteAsync: jest.fn(async () => {}),
}));

const { AddJob } = require('../domains/resource/addJob');
const { ResourceRepository } = require('../domains/resource/repository');

let sqlite: any;
beforeEach(() => {
  const h = createDeviceDb();
  mockDevice.db = h.db; mockDevice.expoDb = h.expoDb; sqlite = h.sqlite;
  sqlite.exec(`INSERT INTO workspaces (id, name, color, target_attendance) VALUES (6, 'Soft Computing', '#000', 75)`);
  mockFiles.clear(); mockSaves.length = 0; mockFail.clear();
  AddJob.clear();
});

const row = (id: string, o: object = {}) => ({ id, title: `${id}.pdf`, uri: `file:///cache/${id}.pdf`, ext: 'pdf', size: 100, hash: null, mime: 'application/pdf', st: 'wait', ...o });
const dest = { id: 6, short: 'SC', name: 'Soft Computing' };
const saved = () => sqlite.prepare('SELECT workspace_id, title, type, file_hash FROM resources ORDER BY id').all();

it('copies waiting rows in order and leaves skipped and unreadable rows alone', async () => {
  await AddJob.start([row('a'), row('b', { st: 'skip' }), row('c', { st: 'bad' }), row('d')], dest);
  expect(AddJob.get().rows.map((r: any) => r.st)).toEqual(['done', 'skip', 'bad', 'done']);
  expect(AddJob.get().running).toBe(false);
  expect(saved()).toEqual([
    { workspace_id: 6, title: 'a.pdf', type: 'file', file_hash: 'hash-of-file:///cache/a.pdf' },
    { workspace_id: 6, title: 'd.pdf', type: 'file', file_hash: 'hash-of-file:///cache/d.pdf' },
  ]);
});

it('shares the stored file with an identical upload, unless that file is gone', async () => {
  await AddJob.start([row('a')], dest);
  const first = mockSaves[0];
  await AddJob.start([row('a2', { uri: first.uri, hash: 'hash-of-file:///cache/a.pdf' })], dest);
  expect(mockSaves[1].existing).toMatch(/\.pdf$/); // same file, second row
  mockFiles.clear(); // restored from a backup without its files
  await AddJob.start([row('a3', { uri: first.uri, hash: 'hash-of-file:///cache/a.pdf' })], { id: null, short: 'General', name: 'General' });
  expect(mockSaves[2].existing).toBeUndefined();
  expect(saved().map((r: any) => r.workspace_id)).toEqual([6, 6, null]);
});

it('a failed copy is "not added" and the others still go in', async () => {
  mockFail.add('file:///cache/b.pdf');
  await AddJob.start([row('a'), row('b'), row('c')], dest);
  expect(AddJob.get().rows.map((r: any) => r.st)).toEqual(['done', 'bad', 'done']);
  expect(saved()).toHaveLength(2);
});

it('cancel the rest stops after the current file and keeps what was copied', async () => {
  const unsub = AddJob.subscribe(() => { if (AddJob.get()?.rows[0].st === 'copy') AddJob.cancelRest(); });
  await AddJob.start([row('a'), row('b'), row('c')], dest);
  unsub();
  expect(AddJob.get().rows.map((r: any) => r.st)).toEqual(['done', 'cancel', 'cancel']);
  expect(saved()).toHaveLength(1);
  await expect(AddJob.start([row('x')], dest)).resolves.toBeUndefined(); // a new job can start
});

describe('resource writes', () => {
  it('finds a duplicate by hash with its course name', async () => {
    await AddJob.start([row('a')], dest);
    expect(ResourceRepository.findByHash('hash-of-file:///cache/a.pdf')).toMatchObject({ title: 'a.pdf', course: 'Soft Computing' });
    expect(ResourceRepository.findByHash('nope')).toBeNull();
  });

  it('refuses names the app did not store, and links that are not http(s)', () => {
    expect(() => ResourceRepository.addFile({ workspaceId: 6, title: 'x', uri: '../../databases/app.db', hash: 'h', sizeBytes: 1 })).toThrow();
    expect(() => ResourceRepository.addLink({ workspaceId: 6, title: '', url: 'javascript:alert(1)' })).toThrow('Check the link');
    const id = ResourceRepository.addLink({ workspaceId: null, title: ' ', url: 'https://youtu.be/abc' });
    expect(ResourceRepository.get(id)).toMatchObject({ title: 'YouTube link', type: 'link', uri: 'https://youtu.be/abc', workspaceId: null });
  });

  it('notes fall back to "Untitled note", and rename/move/delete/undo keep the same row', () => {
    const id = ResourceRepository.createNote({ workspaceId: 6, title: '', text: '# Hi' });
    expect(ResourceRepository.get(id)).toMatchObject({ title: 'Untitled note', type: 'note', textContent: '# Hi' });
    ResourceRepository.updateNote(id, { title: 'Unit 3', text: 'body' });
    ResourceRepository.rename(id, '  Unit 3 recap ');
    ResourceRepository.move(id, null);
    expect(ResourceRepository.get(id)).toMatchObject({ title: 'Unit 3 recap', textContent: 'body', workspaceId: null });
    expect(() => ResourceRepository.rename(id, '  ')).toThrow('Enter a name.');
    const gone = ResourceRepository.remove(id);
    expect(ResourceRepository.get(id)).toBeUndefined();
    ResourceRepository.restore(gone);
    expect(ResourceRepository.get(id)).toEqual(gone);
  });

  it('keeps a deleted file through the Undo window, and only deletes it when unused', async () => {
    jest.useFakeTimers();
    try {
      await AddJob.start([row('a')], dest);
      const r = sqlite.prepare('SELECT id, uri FROM resources').get();
      const gone = ResourceRepository.remove(r.id);
      ResourceRepository.purgeLater(gone.uri, 5000);
      ResourceRepository.restore(gone); // Undo
      await jest.advanceTimersByTimeAsync(6000);
      expect(mockFiles.has(r.uri)).toBe(true);
      ResourceRepository.remove(r.id);
      ResourceRepository.purgeLater(r.uri, 5000);
      expect(mockFiles.has(r.uri)).toBe(true); // not yet
      await jest.advanceTimersByTimeAsync(6000);
      expect(mockFiles.has(r.uri)).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });
});
