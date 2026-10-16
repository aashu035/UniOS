import Storage from 'expo-sqlite/kv-store';

/**
 * Small per-phone preferences that are not records: recent searches, where a video
 * or PDF was left. Stored with expo-sqlite's key-value store under "unios." keys.
 * Clear all data removes them (clearAllData → Prefs.clearAll).
 */
const PREFIX = 'unios.';

export const Prefs = {
  getJSON<T>(key: string, fallback: T): T {
    try {
      const raw = Storage.getItemSync(PREFIX + key);
      return raw == null ? fallback : (JSON.parse(raw) as T);
    } catch {
      return fallback;
    }
  },
  setJSON(key: string, value: unknown): void {
    try { Storage.setItemSync(PREFIX + key, JSON.stringify(value)); } catch (e) { console.warn('Could not save a preference', e); }
  },
  remove(key: string): void {
    try { Storage.removeItemSync(PREFIX + key); } catch { /* nothing stored */ }
  },
  clearAll(): void {
    try { for (const k of Storage.getAllKeysSync()) if (k.startsWith(PREFIX)) Storage.removeItemSync(k); } catch { /* store not created yet */ }
  },
};
