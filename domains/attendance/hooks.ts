import { useState, useEffect, useCallback } from 'react';
import { AttendanceRepository } from './repository';

export function useAttendance(workspaceId: number) {
  const [history, setHistory] = useState<any[]>([]);
  const [portalData, setPortalData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadAttendance = useCallback(async () => {
    try {
      setIsLoading(true);
      const historyData = await AttendanceRepository.getAttendanceHistory(workspaceId);
      const portal = await AttendanceRepository.getPortalAttendance(workspaceId);
      setHistory(historyData);
      setPortalData(portal);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load attendance'));
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  return { history, portalData, isLoading, error, refreshAttendance: loadAttendance };
}
