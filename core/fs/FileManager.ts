import * as FileSystem from 'expo-file-system/legacy';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { isOwnAvatar, isStoredUpload } from './names';

/**
 * FileManager handles offline-first file storage, native hashing (no JS buffer),
 * and deletes that only touch names this app wrote.
 */

// We store files in the app's document directory
const STORAGE_DIR = `${FileSystem.documentDirectory}resources/`;

export const FileManager = {
  /**
   * Initializes the storage directory if it doesn't exist
   */
  async init() {
    const dirInfo = await FileSystem.getInfoAsync(STORAGE_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(STORAGE_DIR, { intermediates: true });
    }
  },

  /**
   * Generates a native SHA-256 hash using react-native-blob-util
   * This bypasses the JS bridge to prevent OOM on large files (e.g. video)
   */
  async generateFileHash(fileUri: string): Promise<string> {
    try {
      // react-native-blob-util natively reads the file and generates a hash
      // avoiding memory spikes on the JS thread.
      let path = fileUri;
      if (path.startsWith('file://')) {
        path = path.replace('file://', '');
      }
      const ReactNativeBlobUtil = require('react-native-blob-util').default;
      const hash = await ReactNativeBlobUtil.fs.hash(path, 'sha256');
      return hash;
    } catch (e) {
      console.error('Error hashing file:', e);
      throw e;
    }
  },

  /**
   * Generates a hash for the source file, and copies it to the storage dir if it doesn't already exist.
   * If existingHashFilename is provided, it skips copying and returns that filename instead.
   * @param sourceUri The temporary URI from the document picker
   * @param extension The file extension (e.g., '.pdf')
   * @param existingHashFilename If provided, skips the physical copy and re-uses this UUID filename
   */
  async saveFile(sourceUri: string, extension: string, existingHashFilename?: string): Promise<{ filename: string, hash: string, sizeBytes: number }> {
    await this.init();
    
    // Hash the file first
    const hash = await this.generateFileHash(sourceUri);
    
    // Get file size
    const fileInfo = await FileSystem.getInfoAsync(sourceUri);
    const sizeBytes = fileInfo.exists ? fileInfo.size : 0;
    
    // Generate or use existing filename
    let filename = existingHashFilename;
    if (!filename) {
      const uuid = uuidv4();
      const ext = extension.startsWith('.') ? extension : `.${extension}`;
      filename = `${uuid}${ext}`;
      
      const destinationUri = `${STORAGE_DIR}${filename}`;
      
      // Copy file
      await FileSystem.copyAsync({
        from: sourceUri,
        to: destinationUri,
      });
    }
    
    return {
      filename,
      hash,
      sizeBytes,
    };
  },
  
  /**
   * Given a relative filename, returns the absolute local URI.
   * Throws an error if path traversal sequences are detected.
   */
  getAbsolutePath(filename: string): string {
    // Only names saveFile creates. A plain "no .. or /" check is not enough: the
    // native layer decodes "%2E%2E%2F" to "../" after this check has run.
    if (!isStoredUpload(filename)) throw new Error('That is not a file this app stored.');
    return `${STORAGE_DIR}${filename}`;
  },

  /**
   * Deletes a file from the local storage
   */
  async deleteFile(filename: string): Promise<void> {
    if (!isStoredUpload(filename)) return;
    const absolutePath = this.getAbsolutePath(filename);
    try {
      const info = await FileSystem.getInfoAsync(absolutePath);
      if (info.exists && !info.isDirectory) {
        await FileSystem.deleteAsync(absolutePath, { idempotent: true });
      }
    } catch (e) {
      console.error(`Failed to delete file ${filename}:`, e);
    }
  },

  /**
   * Delete every upload and the profile photo (Clear all data). Only names this app
   * wrote are touched (core/fs/names.ts). Returns the number of files deleted.
   */
  async deleteAllOwnFiles(): Promise<number> {
    const docDir = FileSystem.documentDirectory ?? '';
    const places: Array<[string, (n: unknown) => boolean]> = [[STORAGE_DIR, isStoredUpload], [docDir, isOwnAvatar]];
    let count = 0;
    for (const [dir, isOurs] of places) {
      if (!dir) continue;
      let names: string[] = [];
      try { names = await FileSystem.readDirectoryAsync(dir); } catch { continue; } // folder not created yet
      for (const n of names) {
        if (!isOurs(n)) continue;
        await FileSystem.deleteAsync(`${dir}${n}`, { idempotent: true });
        count++;
      }
    }
    return count;
  },
};
