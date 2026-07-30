import { useState, useEffect, useCallback } from 'react';
import { TaskRepository } from './repository';

export function useTasks(workspaceId?: number) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadTasks = useCallback(async () => {
    try {
      setIsLoading(true);
      let data = [];
      if (workspaceId !== undefined) {
        data = await TaskRepository.getTasksForWorkspace(workspaceId);
      } else {
        data = await TaskRepository.getPendingTasks();
      }
      setTasks(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load tasks'));
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  return { tasks, isLoading, error, refreshTasks: loadTasks };
}
