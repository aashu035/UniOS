import { db } from '../../core/db/client';
import { attendance, portalAttendance } from './model';
import { workspaces } from '../workspace/model';
import { eq } from 'drizzle-orm';

export interface AttendanceStats {
  workspaceId: number;
  workspaceName: string;
  workspaceColor: string;
  workspaceCode: string;
  components: {
    id: number;
    type: string;
    attended: number;
    missed: number;
    exempt: number;
    total: number;
    percentage: number | null;
  }[];
  overallAttended: number;
  overallMissed: number;
  overallExempt: number;
  overallTotal: number;
  overallPercentage: number | null;
}

export class AttendanceService {
  /**
   * Retrieves the specific schedule occurrences eligible for attendance today.
   */
  static async getEligibleOccurrences(workspaceId: number, dateStr: string) {
    const { CalendarService } = require('../calendar/service');
    const events = await CalendarService.getEffectiveSchedule(dateStr, dateStr);
    return events.filter((e: any) => e.workspaceId === workspaceId && e.componentId);
  }

  /**
   * Fetches the authoritative Portal Record.
   * INVARIANT: Portal records are read-only from the application side. They are
   * updated by backend sync jobs only — see `updatePortalAttendance` below.
   */
  static async getPortalAttendanceState(): Promise<AttendanceStats[]> {
    const allWorkspaces = await db.select().from(workspaces).all();
    const portalRecords = await db.select().from(portalAttendance).all();

    return allWorkspaces.map(ws => {
      // In a real portal sync, this might be broken down by component.
      // We will emulate it by finding the aggregate portal record for the workspace.
      const record = portalRecords.find(r => r.workspaceId === ws.id);

      const overallTotal = record?.portalTotal || 0;
      const overallAttended = record?.portalPresent || 0;
      const overallMissed = overallTotal - overallAttended;
      const overallPercentage = record?.portalPercent ?? null;

      return {
        workspaceId: ws.id,
        workspaceName: ws.name,
        workspaceColor: ws.color || '#3B82F6',
        workspaceCode: ws.code || '',
        components: [], // Portal might not provide component breakdowns always
        overallAttended,
        overallMissed,
        overallExempt: 0,
        overallTotal,
        overallPercentage: overallPercentage !== null ? Math.round(overallPercentage) : null
      };
    });
  }

  /**
   * Write path for Local Record.
   */
  static async markLocalAttendance(
    occurrenceKey: string,
    componentId: number,
    date: string,
    status: 'present' | 'absent' | 'exempt' | 'holiday' | 'cancelled'
  ): Promise<void> {
    const { CalendarService } = require('../calendar/service');
    // Security: Validate the occurrence actually exists for this component and date
    const eligible = await CalendarService.getEffectiveSchedule(date, date);
    const validOccurrence = eligible.find((e: any) => e.id === occurrenceKey && e.componentId === componentId);

    if (!validOccurrence) {
      throw new Error(`SECURITY_VIOLATION: Occurrence ${occurrenceKey} is not valid for component ${componentId} on ${date}`);
    }

    // Check if exists
    const existing = await db.select().from(attendance).where(eq(attendance.occurrenceId, occurrenceKey)).get();

    if (existing) {
      await db.update(attendance).set({ status, identityStatus: 'resolved' }).where(eq(attendance.id, existing.id));
    } else {
      await db.insert(attendance).values({
        occurrenceId: occurrenceKey,
        identityStatus: 'resolved',
        componentId: validOccurrence.componentId,
        date: validOccurrence.date,
        status,
        source: 'local'
      });
    }
  }

  /**
   * Write path for Portal Record.
   * INVARIANT: Portal records are strictly read-only from the application side.
   * They should only be updated via backend sync jobs.
   */
  static async updatePortalAttendance(): Promise<never> {
    throw new Error("SECURITY_VIOLATION: Portal attendance cannot be manually updated from the application. It is strictly read-only.");
  }
}
