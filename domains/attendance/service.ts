import { db } from '../../core/db/client';
import { attendance, portalAttendance } from './model';
import { workspaces, courseComponents } from '../workspace/model';
import { eq, and } from 'drizzle-orm';

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
   * Calculates the local attendance state by querying the `attendance` table.
   * This represents the user's manual "Live Planning" tracker.
   */
  static async getLocalAttendanceState(): Promise<AttendanceStats[]> {
    const allWorkspaces = await db.select().from(workspaces).all();
    const allComponents = await db.select().from(courseComponents).all();
    const allRecords = await db.select().from(attendance).all();

    return allWorkspaces.map(ws => {
      const comps = allComponents.filter(c => c.workspaceId === ws.id);
      
      let overallAttended = 0;
      let overallMissed = 0;
      let overallExempt = 0;
      let overallTotal = 0;

      const componentStats = comps.map(c => {
        const records = allRecords.filter(r => r.componentId === c.id);
        
        const present = records.filter(r => r.status === 'present').length;
        const absent = records.filter(r => r.status === 'absent').length;
        const exempt = records.filter(r => r.status === 'exempt').length;
        // holiday/cancelled are ignored completely
        
        const attended = present + exempt; // Duty counts as present
        const missed = absent;
        const total = attended + missed;
        const percentage = total > 0 ? Math.round((attended / total) * 100) : null;

        overallAttended += attended;
        overallMissed += missed;
        overallExempt += exempt;
        overallTotal += total;

        return {
          id: c.id,
          type: c.type,
          attended,
          missed,
          exempt,
          total,
          percentage
        };
      });

      const overallPercentage = overallTotal > 0 ? Math.round((overallAttended / overallTotal) * 100) : null;

      return {
        workspaceId: ws.id,
        workspaceName: ws.name,
        workspaceColor: ws.color || '#3B82F6',
        workspaceCode: ws.code || '',
        components: componentStats,
        overallAttended,
        overallMissed,
        overallExempt,
        overallTotal,
        overallPercentage
      };
    });
  }

  /**
   * Fetches the authoritative Portal Record.
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
  static async markLocalAttendance(componentId: number, date: string, status: 'present'|'absent'|'holiday'|'cancelled'): Promise<void> {
    // Check if exists
    const existing = await db.select().from(attendance).where(and(eq(attendance.componentId, componentId), eq(attendance.date, date))).get();
    
    if (existing) {
      await db.update(attendance).set({ status }).where(eq(attendance.id, existing.id));
    } else {
      await db.insert(attendance).values({ componentId, date, status, source: 'local' });
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
