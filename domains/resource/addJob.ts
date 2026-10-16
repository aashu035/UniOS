import * as FileSystem from 'expo-file-system/legacy';
import { FileManager } from '../../core/fs/FileManager';
import { isStoredUpload } from '../../core/fs/names';
import { ResourceRepository } from './repository';
import type { CopyState } from './files';

/**
 * Copying picked files into UniOS (design UniAdd §1b). One file at a time, in
 * list order. It lives outside any screen, so leaving the screen doesn't stop
 * it while the app is open. "Cancel the rest" stops after the current file;
 * files already copied are kept.
 */

export type JobRow = { id: string; title: string; uri: string; ext: string; size: number | null; hash: string | null; mime: string | null; st: CopyState };
export type JobDest = { id: number | null; short: string; name: string };
export type JobState = { running: boolean; dest: JobDest; rows: JobRow[] };

let state: JobState | null = null;
let cancelled = false;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
const setRow = (id: string, st: CopyState) => {
  if (!state) return;
  state = { ...state, rows: state.rows.map((r) => (r.id === id ? { ...r, st } : r)) };
  emit();
};

/** A stored file with this hash that is still on the phone, so the copy can share it. */
async function sharedFile(hash: string): Promise<string | undefined> {
  const hit = ResourceRepository.findByHash(hash);
  if (!hit || !isStoredUpload(hit.uri)) return undefined;
  const info = await FileSystem.getInfoAsync(FileManager.getAbsolutePath(hit.uri)).catch(() => null);
  return info?.exists ? hit.uri : undefined;
}

export const AddJob = {
  get: (): JobState | null => state,
  subscribe(fn: () => void) { subs.add(fn); return () => { subs.delete(fn); }; },

  /** Start copying. Rows not in 'wait' (skipped, unreadable) are shown but not copied. */
  async start(rows: JobRow[], dest: JobDest) {
    if (state?.running) throw new Error('Files are still being copied.');
    cancelled = false;
    state = { running: true, dest, rows };
    emit();
    for (const row of rows) {
      if (row.st !== 'wait') continue;
      if (cancelled) { setRow(row.id, 'cancel'); continue; }
      setRow(row.id, 'copy');
      try {
        const hash = row.hash ?? await FileManager.generateFileHash(row.uri);
        const saved = await FileManager.saveFile(row.uri, row.ext, await sharedFile(hash), hash);
        if (!saved.sizeBytes) throw new Error('empty');
        ResourceRepository.addFile({ workspaceId: dest.id, title: row.title, uri: saved.filename, hash: saved.hash, sizeBytes: saved.sizeBytes });
        setRow(row.id, 'done');
      } catch (e) {
        console.error('Could not add a file', e instanceof Error ? e.message : e);
        setRow(row.id, 'bad');
      }
      // The picker's own copy in the cache is no longer needed.
      const cache = FileSystem.cacheDirectory;
      if (cache && row.uri.startsWith(cache)) FileSystem.deleteAsync(row.uri, { idempotent: true }).catch(() => {});
    }
    state = state ? { ...state, running: false } : null;
    emit();
  },

  cancelRest() { cancelled = true; },
  /** Forget a finished job (Done, or a new add). */
  clear() { if (!state?.running) { state = null; emit(); } },
};
