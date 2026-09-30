import { db } from '../../core/db/client';
import { tasks } from './model';
import { eq, desc, asc, and, lte, sql } from 'drizzle-orm';
import { getLocalDateString } from '../../core/utils/date';
import { workspaces } from '../workspace/model';

const prioritySort = sql`CASE ${tasks.priority} WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END`;

export class TaskRepository {
  static async getTaskById(id: number) {
    return await db.select().from(tasks).where(eq(tasks.id, id)).get();
  }

  static async getTasksForWorkspace(workspaceId: number) {
    return await db.select()
      .from(tasks)
      .where(eq(tasks.workspaceId, workspaceId))
      .orderBy(prioritySort, asc(tasks.dueDate));
  }

  static async getPendingTasks() {
    return await db.select()
      .from(tasks)
      .where(eq(tasks.status, 'pending'))
      .orderBy(prioritySort, asc(tasks.dueDate));
  }

  static async getTasksDueSoon() {
    const today = getLocalDateString(new Date());
    return await db.select()
      .from(tasks)
      .where(and(
        eq(tasks.status, 'pending'),
        lte(tasks.dueDate, today)
      ))
      .orderBy(prioritySort, asc(tasks.dueDate));
  }

  static async createTask(data: {
    workspaceId: number;
    title: string;
    description?: string;
    type?: string;
    dueDate?: string;
    priority?: string;
    status?: string;
  }) {
    // 1. Validate workspace existence
    const workspace = await db.select().from(workspaces).where(eq(workspaces.id, data.workspaceId)).get();
    if (!workspace) {
      throw new Error(`Workspace with id ${data.workspaceId} does not exist.`);
    }

    return db.insert(tasks).values({
      workspaceId: data.workspaceId,
      title: data.title,
      description: data.description,
      type: data.type || 'assignment',
      dueDate: data.dueDate,
      priority: data.priority || 'medium',
      status: data.status || 'pending',
    }).returning().get();
  }

  static async getAllTasksWithWorkspaces() {
    const res = await db.select({
      id: tasks.id,
      title: tasks.title,
      dueDate: tasks.dueDate,
      status: tasks.status,
      priority: tasks.priority,
      workspaceName: workspaces.name,
      workspaceColor: workspaces.color,
      workspaceId: workspaces.id,
    })
    .from(tasks)
    .leftJoin(workspaces, eq(tasks.workspaceId, workspaces.id))
    .orderBy(prioritySort, asc(tasks.dueDate))
    .all();

    return res.map(r => ({
      ...r,
      status: r.status || 'pending',
      priority: (r.priority || 'medium') as import('./model').TaskPriority,
      workspaceName: r.workspaceName || 'General',
      workspaceColor: r.workspaceColor || '#8E8E93',
      workspaceId: r.workspaceId || 0,
    }));
  }

  static async updateTaskStatus(id: number, status: 'pending' | 'completed' | 'submitted' | 'graded' | 'overdue') {
    return await db.update(tasks)
      .set({ status })
      .where(eq(tasks.id, id))
      .returning()
      .get();
  }

  static async updateTask(id: number, data: Partial<{
    title: string;
    description: string;
    type: string;
    dueDate: string;
    priority: string;
    status: string;
    marksObtained: number;
    marksTotal: number;
    feedback: string;
    // explicit exclusion of workspaceId for safety
  }>) {
    return db.update(tasks).set(data).where(eq(tasks.id, id)).returning().get();
  }

  static async deleteTask(id: number) {
    return db.delete(tasks).where(eq(tasks.id, id)).run();
  }
}
