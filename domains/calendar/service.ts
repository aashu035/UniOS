import { db } from '../../core/db/client';
import { recurringSchedules, scheduleExceptions, calendarEvents } from './model';
import { courseComponents, workspaces, componentVenueAssignments } from '../workspace/model';
import { venues } from '../venue/model';
import { faculty } from '../faculty/model';
import { eq, and, gte, lte, asc, desc } from 'drizzle-orm';

export interface EffectiveOccurrence {
  id: string; // synthetic ID for UI keying
  workspaceId: number;
  workspaceName: string;
  workspaceColor: string;
  componentId?: number;
  componentType: string;
  date: string; // ISO date string (YYYY-MM-DD)
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  venueName?: string;
  facultyName?: string;
  isException: boolean;
  exceptionAction?: string;
}

export interface AcademicWeatherFacts {
  upcomingClasses: number;
  labs: number;
  deadlines: number;
  exams: number;
  attendanceRisks: number;
}

export interface AcademicWeatherState {
  state: 'Light week' | 'Balanced week' | 'Busy week' | 'Heavy week';
  description: string;
}

export class CalendarService {
  /**
   * Generates the effective schedule for a given date range by merging:
   * 1. Recurring schedules mapped to specific dates within the range.
   * 2. Schedule exceptions (cancellations, moves, extras).
   */
  static async getEffectiveSchedule(startDateStr: string, endDateStr: string): Promise<EffectiveOccurrence[]> {
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    end.setHours(23, 59, 59, 999);

    const occurrences: EffectiveOccurrence[] = [];

    // 1. Fetch all recurring schedules with their component, workspace, default venue/faculty
    // For simplicity without massive joins in Drizzle, we fetch everything needed for active workspaces.
    const allWorkspaces = await db.select().from(workspaces).all();
    const allComponents = await db.select().from(courseComponents).all();
    const allRecurring = await db.select().from(recurringSchedules).all();
    
    // Fetch venue assignments
    const allVenueAssignments = await db.select({
      componentId: componentVenueAssignments.componentId,
      venueName: venues.name,
    })
    .from(componentVenueAssignments)
    .leftJoin(venues, eq(componentVenueAssignments.venueId, venues.id))
    .all();

    const facultyList = await db.select().from(faculty).all();
    
    // Maps for fast lookup
    const workspaceMap = new Map(allWorkspaces.map(w => [w.id, w]));
    const compMap = new Map(allComponents.map(c => [c.id, c]));
    const compVenueMap = new Map(allVenueAssignments.map(v => [v.componentId, v.venueName]));
    const facultyMap = new Map(facultyList.map(f => [f.id, f.name]));

    // 2. Expand recurring schedules into dates
    // Loop through each day in the date range
    let current = new Date(start);
    while (current <= end) {
      const currentDayOfWeek = current.getDay(); // 0=Sun, 1=Mon
      const currentDateStr = current.toISOString().split('T')[0];

      for (const rec of allRecurring) {
        if (rec.dayOfWeek === currentDayOfWeek) {
          // Check effective dates
          if (rec.effectiveStartDate && currentDateStr < rec.effectiveStartDate) continue;
          if (rec.effectiveEndDate && currentDateStr > rec.effectiveEndDate) continue;

          const comp = compMap.get(rec.componentId);
          if (!comp) continue;
          const ws = workspaceMap.get(comp.workspaceId);
          if (!ws) continue;

          // Determine venue (Component level assignment > recurring override)
          // For this basic version, we rely on component Venue Assignment
          const venueName = compVenueMap.get(comp.id);
          const facultyName = comp.facultyId ? facultyMap.get(comp.facultyId) : undefined;

          occurrences.push({
            id: `rec_${rec.id}_${currentDateStr}`,
            workspaceId: ws.id,
            workspaceName: ws.name,
            workspaceColor: ws.color || '#3B82F6',
            componentId: comp.id,
            componentType: comp.type,
            date: currentDateStr,
            startTime: rec.startTime,
            endTime: rec.endTime,
            venueName: venueName || undefined,
            facultyName: facultyName || undefined,
            isException: false,
          });
        }
      }
      current.setDate(current.getDate() + 1);
    }

    // 3. Fetch exceptions for the date range
    const exceptions = await db.select()
      .from(scheduleExceptions)
      .where(and(
        gte(scheduleExceptions.specificDate, startDateStr),
        lte(scheduleExceptions.specificDate, endDateStr)
      ))
      .all();

    // 4. Apply Exceptions
    for (const ex of exceptions) {
      if (ex.action === 'cancel') {
        // Remove the occurrence
        const index = occurrences.findIndex(o => 
          o.componentId === ex.componentId && 
          o.date === ex.specificDate && 
          !o.isException
        );
        if (index !== -1) occurrences.splice(index, 1);
      } 
      else if (ex.action === 'move' || ex.action === 'replace') {
        // Modify existing
        const index = occurrences.findIndex(o => 
          o.componentId === ex.componentId && 
          o.date === ex.specificDate &&
          !o.isException
        );
        if (index !== -1) {
          occurrences[index].startTime = ex.startTime || occurrences[index].startTime;
          occurrences[index].endTime = ex.endTime || occurrences[index].endTime;
          occurrences[index].isException = true;
          occurrences[index].exceptionAction = ex.action;
          // Venue override would go here if we fetched it for exceptions
        }
      }
      else if (ex.action === 'extra') {
        // Add new
        const comp = compMap.get(ex.componentId);
        if (!comp) continue;
        const ws = workspaceMap.get(comp.workspaceId);
        if (!ws) continue;
        const venueName = compVenueMap.get(comp.id);
        const facultyName = comp.facultyId ? facultyMap.get(comp.facultyId) : undefined;

        occurrences.push({
          id: `ex_${ex.id}`,
          workspaceId: ws.id,
          workspaceName: ws.name,
          workspaceColor: ws.color || '#3B82F6',
          componentId: comp.id,
          componentType: comp.type,
          date: ex.specificDate,
          startTime: ex.startTime || '00:00',
          endTime: ex.endTime || '00:00',
          venueName: venueName || undefined,
          facultyName: facultyName || undefined,
          isException: true,
          exceptionAction: ex.action,
        });
      }
    }

    // 5. Sort occurrences by Date then StartTime
    occurrences.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.startTime.localeCompare(b.startTime);
    });

    return occurrences;
  }

  /**
   * Deterministic logic to calculate Academic Weather based on provided facts.
   */
  static calculateAcademicWeather(facts: AcademicWeatherFacts): AcademicWeatherState {
    if (facts.exams > 0 || facts.attendanceRisks > 0) {
      return { 
        state: 'Heavy week', 
        description: `${facts.exams} exams, ${facts.deadlines} deadlines, ${facts.attendanceRisks} attendance risk(s).` 
      };
    } else if (facts.labs > 2 || facts.deadlines > 3) {
      return { 
        state: 'Busy week', 
        description: `${facts.labs} labs, ${facts.deadlines} deadlines.` 
      };
    } else if (facts.upcomingClasses < 10 && facts.deadlines === 0) {
      return { 
        state: 'Light week', 
        description: 'Take it easy.' 
      };
    } else {
      return { 
        state: 'Balanced week', 
        description: `${facts.upcomingClasses} classes, ${facts.deadlines} deadlines.` 
      };
    }
  }
}
