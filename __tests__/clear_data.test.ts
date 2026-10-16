/**
 * More → Backup & export → Clear all data (audit 2026-10-14, SEC-02).
 * The screen promises: "Deletes your profile, courses, attendance, tasks, files and
 * Gemini key from this phone." The old loop missed day_rules, notifications, the
 * uploaded files, the profile photo and the key.
 */
import { createDeviceDb } from '../testing/expoSqliteHarness';

const mockDevice: { db?: any; expoDb?: any } = {};
jest.mock('../core/db/client', () => ({
  get db() { return mockDevice.db; },
  get expoDb() { return mockDevice.expoDb; },
}));

// A fake phone file system: documentDirectory/ and documentDirectory/resources/.
const mockFiles = new Set<string>();
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///data/user/0/app/files/',
  readDirectoryAsync: async (dir: string) => [...mockFiles].filter((f) => f.startsWith(dir) && !f.slice(dir.length).includes('/')).map((f) => f.slice(dir.length)),
  deleteAsync: async (path: string) => { mockFiles.delete(path); },
  getInfoAsync: async () => ({ exists: false }),
}));
jest.mock('react-native-get-random-values', () => ({}));
jest.mock('uuid', () => ({ v4: () => '00000000-0000-4000-8000-000000000000' }));
const mockStore = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  getItemAsync: async (k: string) => mockStore.get(k) ?? null,
  setItemAsync: async (k: string, v: string) => { mockStore.set(k, v); },
  deleteItemAsync: async (k: string) => { mockStore.delete(k); },
}));

const mockPrefs = new Map<string, string>();
jest.mock('expo-sqlite/kv-store', () => ({
  __esModule: true,
  default: {
    getItemSync: (k: string) => mockPrefs.get(k) ?? null,
    setItemSync: (k: string, v: string) => { mockPrefs.set(k, v); },
    removeItemSync: (k: string) => mockPrefs.delete(k),
    getAllKeysSync: () => [...mockPrefs.keys()],
  },
}));

const { clearAllData } = require('../core/db/clearData');
const { DayRuleRepository } = require('../domains/calendar/dayRules');

const DOC = 'file:///data/user/0/app/files/';
const UPLOAD = '3f2b8c1e-9d4a-4e7b-8c2d-1a2b3c4d5e6f.pdf';

it('removes every row, every upload, the profile photo, the Gemini key and recent searches', async () => {
  const h = createDeviceDb();
  mockDevice.db = h.db; mockDevice.expoDb = h.expoDb;
  h.sqlite.exec(`
    INSERT INTO students (id, name, branch, current_semester) VALUES (1, 'Test Student', 'CSE', 5);
    INSERT INTO semesters (id, number, name, start_date, is_active) VALUES (1, 5, 'Sem 5', '2026-07-01', 1);
    INSERT INTO workspaces (id, semester_id, name, color, target_attendance) VALUES (1, 1, 'OS', '#000', 75);
    INSERT INTO course_components (id, workspace_id, type, duration_minutes) VALUES (1, 1, 'theory', 60);
    INSERT INTO recurring_schedules (id, component_id, day_of_week, start_time, end_time) VALUES (1, 1, 4, '09:00', '10:00');
    INSERT INTO tasks (id, workspace_id, title, type, due_date, priority, status) VALUES (1, 1, 'Medical certificate for leave', 'other', '2026-11-02', 'high', 'pending');
    INSERT INTO resources (id, workspace_id, title, type, uri) VALUES (1, NULL, 'Medical certificate', 'file', '${UPLOAD}');
    INSERT INTO notifications (id, title, message, type) VALUES (1, 'Task due', 'Medical certificate for leave is due 2026-11-02', 'task');
  `);
  await DayRuleRepository.dayOff('2026-10-29', { reason: 'Holiday', note: 'Hospital visit' });
  mockFiles.clear();
  for (const f of [`${DOC}resources/${UPLOAD}`, `${DOC}avatar_1712345678901.jpg`, `${DOC}resources/notes.txt`, `${DOC}SQLite`]) mockFiles.add(f);
  mockStore.set('unios_ai_key_gemini', 'AIza-test-key');
  mockPrefs.set('unios.recentSearches', '["medical certificate"]');
  mockPrefs.set('other.app.key', 'kept');

  await clearAllData();

  const tables: string[] = h.sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '__drizzle%'").all().map((r: any) => r.name);
  const left = Object.fromEntries(tables.map((t) => [t, (h.sqlite.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as any).n]).filter(([, n]) => n > 0));
  expect(left).toEqual({});
  // Our upload and photo are gone; names the app did not write are not touched.
  expect([...mockFiles].sort()).toEqual([`${DOC}SQLite`, `${DOC}resources/notes.txt`]);
  expect(mockStore.has('unios_ai_key_gemini')).toBe(false);
  expect([...mockPrefs.keys()]).toEqual(['other.app.key']);
});
