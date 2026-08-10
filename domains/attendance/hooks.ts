import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { AttendanceRepository } from './repository';

export function useAttendance(workspaceId: number) {
  const [history, setHistory] = useState<any[]>([]);
  const [portalData, setPortalData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadAttendance = useCallback(async () => {
    if (workspaceId <= 0) return;
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

  useFocusEffect(
    useCallback(() => {
      loadAttendance();
    }, [loadAttendance])
  );

  return { history, portalData, isLoading, error, refreshAttendance: loadAttendance };
}

import { calculateAttendanceMetrics } from '../../core/utils/attendance';

export function useAttendanceMetrics(workspaceId: number) {
  const { history, isLoading } = useAttendance(workspaceId);
  const metrics = calculateAttendanceMetrics(history);
  return { metrics, isLoading };
}
