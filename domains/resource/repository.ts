import { db } from '../../core/db/client';
import { resources } from './model';
import { eq, desc } from 'drizzle-orm';

export class ResourceRepository {
  static async getResourcesForWorkspace(workspaceId: number) {
    return await db.select()
      .from(resources)
      .where(eq(resources.workspaceId, workspaceId))
      .orderBy(desc(resources.createdAt));
  }

  static async deleteResource(resourceId: number) {
    const [res] = await db.select().from(resources).where(eq(resources.id, resourceId)).all();
    if (!res) return;
    // The row goes first, so a failure below never leaves a row without its file.
    await db.delete(resources).where(eq(resources.id, resourceId));
    await ResourceRepository.removeFileIfUnused(res.uri);
  }

  /**
   * Delete a stored file once no resource row points at it. Uploads are kept in
   * the app's resources folder under a bare filename (`<uuid>.pdf`), and identical
   * uploads share one file, so a file is only removed when its last row is gone.
   * Links, notes and anything that isn't a bare filename are left alone.
   */
  static async removeFileIfUnused(uri: string | null | undefined) {
    if (!uri || /[/\\:]/.test(uri)) return;
    const stillUsed = db.select({ id: resources.id }).from(resources).where(eq(resources.uri, uri)).limit(1).all();
    if (stillUsed.length) return;
    const { FileManager } = require('../../core/fs/FileManager');
    await FileManager.deleteFile(uri);
  }
}
