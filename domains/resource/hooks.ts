import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { ResourceRepository } from './repository';

export function useResources(workspaceId: number) {
  const [resources, setResources] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadResources = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await ResourceRepository.getResourcesForWorkspace(workspaceId);
      setResources(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load resources'));
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  useFocusEffect(
    useCallback(() => {
      loadResources();
    }, [loadResources])
  );

  return { resources, isLoading, error, refreshResources: loadResources };
}

export function useRecentResources(limit: number = 5) {
  const [resources, setResources] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadResources = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await ResourceRepository.getRecentResources(limit);
      setResources(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load recent resources'));
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

  useFocusEffect(
    useCallback(() => {
      loadResources();
    }, [loadResources])
  );

  return { resources, isLoading, error, refreshResources: loadResources };
}

