import { useState, useCallback, useEffect } from 'react';
import { useFocusEffect } from 'expo-router';
import { AttendanceRepository } from './repository';
import { AttendanceService } from './service';
import { getLocalDateString } from '../../core/utils/date';
import { calculateAttendanceMetrics } from '../../core/utils/attendance';

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

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  return { history, portalData, isLoading, error, refreshAttendance: loadAttendance };
}

export function useAttendanceMetrics(workspaceId: number) {
  const { history, isLoading } = useAttendance(workspaceId);
  const metrics = calculateAttendanceMetrics(history);
  return { metrics, isLoading };
}

export function useEligibleOccurrences(workspaceId: number, dateStr?: string) {
  const [occurrences, setOccurrences] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Derive target date string once per render. It remains stable as a primitive.
  const targetDateStr = dateStr || getLocalDateString(new Date());

  const checkOccurrences = useCallback(async () => {
    if (!workspaceId) return;
    try {
      setIsLoading(true);
      const events = await AttendanceService.getEligibleOccurrences(workspaceId, targetDateStr);
      setOccurrences(events);
    } catch (err) {
      console.error(err);
      setOccurrences([]);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, targetDateStr]);

  useEffect(() => {
    checkOccurrences();
  }, [checkOccurrences]);

  return { occurrences, isLoading, refreshOccurrences: checkOccurrences };
}

export function useEligibleOccurrencesRange(workspaceId: number, startDateStr: string, endDateStr: string) {
  const [occurrences, setOccurrences] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const checkOccurrences = useCallback(async () => {
    if (!workspaceId) return;
    try {
      setIsLoading(true);
      const { CalendarService } = require('../calendar/service');
      const { courseComponents } = require('../workspace/model');
      const { db } = require('../../core/db/client');
      const { eq } = require('drizzle-orm');
      
      // Need all occurrences for this workspace across the date range
      // First get components for this workspace
      const components = await db.select().from(courseComponents).where(eq(courseComponents.workspaceId, workspaceId));
      
      const allEvents = await CalendarService.getEffectiveSchedule(startDateStr, endDateStr);
      
      // Filter only events that belong to this workspace's components
      const componentIds = new Set(components.map((c: any) => c.id));
      const workspaceEvents = allEvents.filter((e: any) => componentIds.has(e.componentId));
      
      setOccurrences(workspaceEvents);
    } catch (err) {
      console.error(err);
      setOccurrences([]);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, startDateStr, endDateStr]);

  useEffect(() => {
    checkOccurrences();
  }, [checkOccurrences]);

  return { occurrences, isLoading, refreshOccurrences: checkOccurrences };
}

export function useAttendanceViewModel(scope: import('./viewmodel').AttendanceScope, weekStart: string, weekEnd: string, selectedDate: string) {
  const [viewModel, setViewModel] = useState<import('./viewmodel').AttendanceViewModel | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadViewModel = useCallback(async () => {
    try {
      setIsLoading(true);
      const { AttendanceViewModelBuilder } = require('./viewmodel');
      const vm = await AttendanceViewModelBuilder.build(scope, weekStart, weekEnd, selectedDate);
      setViewModel(vm);
    } catch (err) {
      console.error(err);
      setViewModel(null);
    } finally {
      setIsLoading(false);
    }
  }, [scope, weekStart, weekEnd, selectedDate]);

  useEffect(() => {
    loadViewModel();
  }, [loadViewModel]);

  return { viewModel, isLoading, refreshViewModel: loadViewModel };
}
export function useAttendanceMutations() {
  const markAttendance = useCallback(async (
    workspaceId: number,
    occurrenceDate: string,
    status: 'present' | 'absent' | 'late' | 'excused' | 'holiday' | 'cancelled' | 'exempt',
    occurrenceId: string,
    componentId?: number,
    notes?: string,
    componentType?: string
  ) => {
    const { AttendanceRepository } = require('./repository');
    const { NotificationService } = require('../notification/service');

    await AttendanceRepository.markAttendance(
      workspaceId,
      occurrenceDate,
      status,
      occurrenceId,
      componentId,
      notes
    );
    
    if (componentType) {
      await NotificationService.attendanceMarked({
        componentType,
        date: occurrenceDate,
        status,
        workspaceId,
      }).catch(() => {});
    }
  }, []);

  const removeAttendance = useCallback(async (occurrenceId: string) => {
    const { AttendanceRepository } = require('./repository');
    await AttendanceRepository.deleteAttendance(occurrenceId);
  }, []);

  return { markAttendance, removeAttendance };
}
