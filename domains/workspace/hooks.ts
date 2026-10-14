import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { WorkspaceRepository } from './repository';

export function useWorkspaces() {
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadWorkspaces = useCallback(async () => {
    try {
      setIsLoading(true);
      const { CourseListService } = require('./CourseListService');
      const data = await CourseListService.getCourses();
      setWorkspaces(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load workspaces'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadWorkspaces();
    }, [loadWorkspaces])
  );

  return { workspaces, isLoading, error, refreshWorkspaces: loadWorkspaces };
}

