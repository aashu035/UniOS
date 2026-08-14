import { db } from '../../core/db/client';
import { resources } from './model';
import { eq, desc } from 'drizzle-orm';
import { workspaces } from '../workspace/model';

export class ResourceRepository {
  static async getResourcesForWorkspace(workspaceId: number) {
    return await db.select()
      .from(resources)
      .where(eq(resources.workspaceId, workspaceId))
      .orderBy(desc(resources.createdAt));
  }

  static async getRecentResources(limit: number = 5) {
    return await db.select({
      id: resources.id,
      title: resources.title,
      type: resources.type,
      uri: resources.uri,
      createdAt: resources.createdAt,
      workspaceName: workspaces.name
    })
    .from(resources)
    .leftJoin(workspaces, eq(resources.workspaceId, workspaces.id))
    .orderBy(desc(resources.createdAt))
    .limit(limit);
  }

  static async deleteResource(resourceId: number) {
    const [res] = await db.select().from(resources).where(eq(resources.id, resourceId));
    if (!res) return;

    // Delete the database entry first (so if this fails, the file is preserved)
    await db.delete(resources).where(eq(resources.id, resourceId));

    // If it's a managed file, delete it from disk safely
    if (res.uri && res.uri.startsWith('file://')) {
      try {
        const FileSystem = require('expo-file-system');
        const fileInfo = await FileSystem.getInfoAsync(res.uri);
        if (fileInfo.exists) {
          await FileSystem.deleteAsync(res.uri);
        }
      } catch (err) {
        console.warn('[ORPHAN_FILE] Failed to delete managed file:', res.uri, err);
        try {
          const AsyncStorage = require('@react-native-async-storage/async-storage').default;
          const existing = await AsyncStorage.getItem('ORPHANED_FILES');
          const orphans = existing ? JSON.parse(existing) : [];
          orphans.push(res.uri);
          await AsyncStorage.setItem('ORPHANED_FILES', JSON.stringify(orphans));
        } catch (storageErr) {
          console.error('Failed to register orphaned file in AsyncStorage:', storageErr);
        }
      }
    }
  }
}
