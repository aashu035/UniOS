import { sql } from 'drizzle-orm';
import { atomic } from './atomic';
import { wipeUserTables } from './backup';
import { FileManager } from '../fs/FileManager';
import { GeminiKey } from '../settings/aiProviders';

/**
 * More → Backup & export → Clear all data. Removes everything UniOS keeps on the
 * phone: every table (in one transaction), uploaded files, the profile photo and
 * the Gemini key. The tables go first, so a failure there changes nothing.
 */
export async function clearAllData(): Promise<void> {
  atomic((tx) => {
    wipeUserTables(tx);
    // Duplicates set aside by migration 0014; not part of backups, still user data.
    tx.run(sql.raw('DELETE FROM attendance_0014_duplicate_archive'));
  });
  await FileManager.deleteAllOwnFiles();
  await GeminiKey.save(null);
}
