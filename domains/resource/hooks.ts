import { useState, useEffect, useCallback } from 'react';
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

  useEffect(() => {
    loadResources();
  }, [loadResources]);

  return { resources, isLoading, error, refreshResources: loadResources };
}
