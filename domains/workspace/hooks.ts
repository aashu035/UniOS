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
      const data = await WorkspaceRepository.getAllWorkspaces();
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

export function useWorkspace(id: number) {
  const [workspaceData, setWorkspaceData] = useState<any | null>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadWorkspace = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await WorkspaceRepository.getWorkspaceById(id);
      const timelineData = await WorkspaceRepository.getTimelineEvents(id);
      setWorkspaceData(data);
      setTimeline(timelineData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load workspace details'));
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      loadWorkspace();
    }, [loadWorkspace])
  );

  return { workspaceData, timeline, isLoading, error, refreshWorkspace: loadWorkspace };
}
