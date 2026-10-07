import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { getLocalDateString } from '../utils/date';

/**
 * Backup actions shared by More → Backup & export and the Profile screen, so
 * there is one way to export and one way to restore.
 */
export async function exportAndShare(): Promise<'shared' | 'saved'> {
  const { exportBackup } = await import('./backup');
  const json = await exportBackup();
  // A dated name, so backups sent over WhatsApp are easy to tell apart.
  const uri = `${FileSystem.cacheDirectory}unios-backup-${getLocalDateString(new Date())}.json`;
  await FileSystem.writeAsStringAsync(uri, json);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: 'Save or send your UniOS backup', UTI: 'public.json' });
    return 'shared';
  }
  return 'saved';
}

/**
 * Let the user pick a backup file and return its text, or null if cancelled.
 * Any file type is allowed: WhatsApp and Drive often rename the .json file
 * (e.g. "DOC-20261007-WA0003._"), and the backup's own format check decides.
 */
export async function pickBackupText(): Promise<string | null> {
  const DocumentPicker = await import('expo-document-picker');
  const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
  if (result.canceled || !result.assets?.length) return null;
  return FileSystem.readAsStringAsync(result.assets[0].uri);
}

export async function restoreFromText(json: string): Promise<void> {
  const { importBackup } = await import('./backup');
  await importBackup(json);
}
