import { CalendarService, EffectiveOccurrence } from '../calendar/service';
import { db } from '../../core/db/client';
import { attendance } from './model';
import { courseComponents, workspaces } from '../workspace/model';
import { eq, inArray, and, gte, lte } from 'drizzle-orm';
import { parseLocalDate, getLocalDateString } from '../../core/utils/date';
import { calculateAttendanceMetrics } from '../../core/utils/attendance';

export type AttendanceScope = 'global' | { workspaceId: number };

export type AttendanceStatusView = 'upcoming' | 'present' | 'absent' | 'exempt' | 'cancelled' | 'unmarked';

export interface AttendanceOccurrenceView {
  occurrenceId: string;
  workspaceId: number;
  workspaceName: string;
  workspaceColor: string;
  componentId: number;
  componentType: string;
  date: string;
  startTime: string;
  endTime: string;
  venueName?: string;
  status: AttendanceStatusView;
  notes?: string;
}

export interface AttendanceDaySummary {
  date: string;
  hasClasses: boolean;
  isAllMarked: boolean;
  hasUnmarkedPast: boolean;
}

export interface AttendanceHistoryGroup {
  date: string;
  occurrences: AttendanceOccurrenceView[];
}

export interface AttendanceMetrics {
  percentage: number | null;
  present: number;
  absent: number;
  exempt: number;
  cancelled: number;
  denominator: number;
  totalScheduled: number;
}

export interface AttendanceViewModel {
  scope: AttendanceScope;
  summary: AttendanceMetrics;
  week: {
    startDate: string;
    endDate: string;
    days: AttendanceDaySummary[];
  };
  selectedDay: {
    date: string;
    occurrences: AttendanceOccurrenceView[];
  };
  recent: AttendanceHistoryGroup[];
}

export class AttendanceViewModelBuilder {
  static async build(
    scope: AttendanceScope,
    weekStartDateStr: string,
    weekEndDateStr: string,
    selectedDateStr: string
  ): Promise<AttendanceViewModel> {
    
    // 1. Fetch effective schedule for the week
    const allEvents = await CalendarService.getEffectiveSchedule(weekStartDateStr, weekEndDateStr);
    
    // Filter events by scope
    let scopedEvents = allEvents;
    if (typeof scope === 'object' && scope.workspaceId) {
      scopedEvents = allEvents.filter(e => e.workspaceId === scope.workspaceId);
    }

    // 2. Fetch all historical records for the scope to calculate summary and recent
    // For a large app, we'd paginate history, but here we can pull all for the workspace/global
    let allRecords = await db.select().from(attendance).all();
    if (typeof scope === 'object' && scope.workspaceId) {
      // Find components for workspace
      const components = await db.select().from(courseComponents).where(eq(courseComponents.workspaceId, scope.workspaceId)).all();
      const compIds = components.map(c => c.id);
      if (compIds.length > 0) {
        allRecords = allRecords.filter(r => compIds.includes(r.componentId));
      } else {
        allRecords = [];
      }
    }

    // 3. Map events to occurrences with status
    const occurrencesMap = new Map<string, AttendanceOccurrenceView[]>();
    
    // Helper to determine status
    const now = new Date();
    const todayStr = getLocalDateString(now);
    const nowTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    for (const event of scopedEvents) {
      if (!event.componentId) continue;
      
      const record = allRecords.find(r => r.occurrenceId === event.id && r.date === event.date);
      let status: AttendanceStatusView = 'unmarked';
      let notes = record?.notes;
      
      if (record) {
        if (record.status === 'holiday') {
          status = 'cancelled'; // We map holiday to cancelled visually
        } else {
          status = record.status as AttendanceStatusView;
        }
      } else {
        if (event.isException && event.exceptionAction === 'cancel') {
          status = 'cancelled';
        } else if (event.date > todayStr) {
          status = 'upcoming';
        } else if (event.date === todayStr && event.startTime > nowTimeStr) {
          status = 'upcoming';
        } else {
          status = 'unmarked';
        }
      }

      const occ: AttendanceOccurrenceView = {
        occurrenceId: event.id,
        workspaceId: event.workspaceId,
        workspaceName: event.workspaceName,
        workspaceColor: event.workspaceColor,
        componentId: event.componentId,
        componentType: event.componentType,
        date: event.date,
        startTime: event.startTime,
        endTime: event.endTime,
        venueName: event.venueName,
        status,
        notes: notes ?? undefined
      };

      if (!occurrencesMap.has(event.date)) occurrencesMap.set(event.date, []);
      occurrencesMap.get(event.date)!.push(occ);
    }

    // 4. Build Days Array (Monday to Sunday)
    const days: AttendanceDaySummary[] = [];
    let curDate = parseLocalDate(weekStartDateStr);
    const endDate = parseLocalDate(weekEndDateStr);
    
    while (curDate <= endDate) {
      const dStr = getLocalDateString(curDate);
      const dayOccs = occurrencesMap.get(dStr) || [];
      const hasClasses = dayOccs.length > 0;
      const isAllMarked = hasClasses && dayOccs.every(o => o.status !== 'unmarked' && o.status !== 'upcoming');
      const hasUnmarkedPast = hasClasses && dayOccs.some(o => o.status === 'unmarked');
      
      days.push({
        date: dStr,
        hasClasses,
        isAllMarked,
        hasUnmarkedPast
      });
      curDate.setDate(curDate.getDate() + 1);
    }

    // 5. Build Selected Day
    const selectedOccurrences = occurrencesMap.get(selectedDateStr) || [];

    // 6. Build Summary Metrics using the shared utility to prevent dual-source-of-truth issues
    const metrics = calculateAttendanceMetrics(allRecords);
    const summary: AttendanceMetrics = {
      present: metrics.present,
      absent: metrics.absent,
      exempt: metrics.exempt,
      cancelled: metrics.cancelledOrHoliday,
      denominator: metrics.total,
      percentage: metrics.percentage,
      totalScheduled: metrics.total + metrics.cancelledOrHoliday
    };

    // 7. Build Recent History (Grouped by Date, latest first)
    const recentMap = new Map<string, AttendanceOccurrenceView[]>();
    
    // Sort allRecords descending by date
    const sortedRecords = [...allRecords].sort((a, b) => b.date.localeCompare(a.date));
    
    // We need component info for these records
    const allWorkspaces = await db.select().from(workspaces).all();
    const allComponents = await db.select().from(courseComponents).all();
    
    for (const record of sortedRecords) {
      const comp = allComponents.find(c => c.id === record.componentId);
      if (!comp) continue;
      const ws = allWorkspaces.find(w => w.id === comp.workspaceId);
      if (!ws) continue;

      let stat = record.status as AttendanceStatusView;
      if (record.status === 'holiday') stat = 'cancelled';

      const occ: AttendanceOccurrenceView = {
        occurrenceId: record.occurrenceId || `legacy_${record.id}`,
        workspaceId: ws.id,
        workspaceName: ws.name,
        workspaceColor: ws.color || '#3B82F6',
        componentId: comp.id,
        componentType: comp.type,
        date: record.date,
        startTime: '00:00', // Legacy fallback
        endTime: '00:00',
        status: stat,
        notes: record.notes ?? undefined
      };

      if (!recentMap.has(record.date)) recentMap.set(record.date, []);
      recentMap.get(record.date)!.push(occ);
    }

    const recent: AttendanceHistoryGroup[] = Array.from(recentMap.entries())
      .map(([date, occs]) => ({ date, occurrences: occs }))
      .slice(0, 10); // Limit to 10 most recent days

    return {
      scope,
      summary,
      week: {
        startDate: weekStartDateStr,
        endDate: weekEndDateStr,
        days
      },
      selectedDay: {
        date: selectedDateStr,
        occurrences: selectedOccurrences
      },
      recent
    };
  }
}
