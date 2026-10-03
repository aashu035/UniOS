import { TaskRepository } from './repository';
import { NotificationService } from '../notification/service';

export class TaskService {
  /**
   * Creates a new task and dispatches appropriate background side-effects 
   * (e.g., scheduling a push notification) without blocking the primary transaction.
   */
  static async createTask(params: {
    workspaceId: number;
    title: string;
    description?: string;
    type?: string;
    dueDate?: string;
    priority?: string;
    status?: string;
  }) {
    const task = await TaskRepository.createTask(params);
    
    // Producer: notify on task creation. Non-blocking: failure here does
    // not surface to the user, the task is already saved in SQLite.
    NotificationService.taskCreated({
      id: (task as any)?.id ?? 0,
      title: params.title,
      workspaceId: params.workspaceId,
    }).catch((e) => {
      console.warn('Failed to schedule task notification:', e);
    });

    return task;
  }

  static async updateTask(id: number, params: any) {
    return TaskRepository.updateTask(id, params);
  }

  static async updateTaskStatus(id: number, status: Parameters<typeof TaskRepository.updateTaskStatus>[1], taskTitle?: string, workspaceId?: number) {
    const result = await TaskRepository.updateTaskStatus(id, status);
    
    // Dispath background side-effect for completion
    if (status === 'submitted' && taskTitle && workspaceId !== undefined) {
      NotificationService.taskCompleted({
        id,
        title: taskTitle,
        workspaceId,
      }).catch((e) => {
        console.warn('Failed to dispatch task completion notification', e);
      });
    }
    
    return result;
  }

  static async deleteTask(id: number) {
    return TaskRepository.deleteTask(id);
  }

  static async getTaskById(id: number) {
    return TaskRepository.getTaskById(id);
  }

  static async getAllTasksWithWorkspaces() {
    return TaskRepository.getAllTasksWithWorkspaces();
  }

  static async getTasksDueSoon() {
    return TaskRepository.getTasksDueSoon();
  }
}
