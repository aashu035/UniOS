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
}
