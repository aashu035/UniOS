import { db } from '../../core/db/client';
import { tasks } from './model';
import { eq, desc, and } from 'drizzle-orm';

export class TaskRepository {
  static async getTasksForWorkspace(workspaceId: number) {
    return await db.select()
      .from(tasks)
      .where(eq(tasks.workspaceId, workspaceId))
      .orderBy(desc(tasks.dueDate));
  }

  static async getPendingTasks() {
    return await db.select()
      .from(tasks)
      .where(eq(tasks.status, 'pending'))
      .orderBy(tasks.dueDate);
  }
}
