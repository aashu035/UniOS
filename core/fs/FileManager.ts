import * as FileSystem from 'expo-file-system/legacy';
import ReactNativeBlobUtil from 'react-native-blob-util';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

/**
 * FileManager handles offline-first file storage, chunked hashing (to prevent OOM),
 * and orphan cleanup syncing with Drizzle.
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
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      throw new Error(`Invalid filename detected (potential path traversal): ${filename}`);
    }
    return `${STORAGE_DIR}${filename}`;
  },

  /**
   * Deletes a file from the local storage
   */
  async deleteFile(filename: string): Promise<void> {
    const absolutePath = this.getAbsolutePath(filename);
    try {
      const info = await FileSystem.getInfoAsync(absolutePath);
      if (info.exists) {
        await FileSystem.deleteAsync(absolutePath, { idempotent: true });
      }
    } catch (e) {
      console.error(`Failed to delete file ${filename}:`, e);
    }
  },

  /**
   * Cleans up orphaned files in the storage directory
   * that do not exist in the provided list of valid filenames
   */
  async cleanupOrphanedFiles(validFilenames: string[]): Promise<void> {
    try {
      await this.init();
      const files = await FileSystem.readDirectoryAsync(STORAGE_DIR);
      
      const validSet = new Set(validFilenames);
      
      for (const file of files) {
        if (!validSet.has(file)) {
          console.log(`Deleting orphaned file: ${file}`);
          await this.deleteFile(file);
        }
      }
    } catch (e) {
      console.error('Failed to cleanup orphaned files:', e);
    }
  }
};
