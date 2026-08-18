import { db } from '../../core/db/client';
import { recurringSchedules, scheduleExceptions, calendarEvents } from './model';
import { courseComponents, workspaces, componentVenueAssignments } from '../workspace/model';
import { venues } from '../venue/model';
import { faculty } from '../faculty/model';
import { eq, and, gte, lte, asc, desc } from 'drizzle-orm';
import { parseLocalDate, getLocalDateString } from '../../core/utils/date';

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
    const start = parseLocalDate(startDateStr);
    const end = parseLocalDate(endDateStr);
    end.setHours(23, 59, 59, 999);

    const occurrences: EffectiveOccurrence[] = [];

    const allWorkspaces = await db.select().from(workspaces).all();
    const allComponents = await db.select().from(courseComponents).all();
    const allRecurring = await db.select().from(recurringSchedules).all();
    
    // Fetch venue assignments
    const { componentVenueAssignments, componentFacultyAssignments } = require('../workspace/model');
    const allVenueAssignments = await db.select({
      componentId: componentVenueAssignments.componentId,
      venueName: venues.name,
      venueId: venues.id,
      effectiveFrom: componentVenueAssignments.effectiveFrom,
      effectiveUntil: componentVenueAssignments.effectiveUntil,
    })
    .from(componentVenueAssignments)
    .leftJoin(venues, eq(componentVenueAssignments.venueId, venues.id))
    .all();

    // Fetch faculty assignments
    const allFacultyAssignments = await db.select({
      componentId: componentFacultyAssignments.componentId,
      facultyName: faculty.name,
      facultyId: faculty.id,
      effectiveFrom: componentFacultyAssignments.effectiveFrom,
      effectiveUntil: componentFacultyAssignments.effectiveUntil,
    })
    .from(componentFacultyAssignments)
    .leftJoin(faculty, eq(componentFacultyAssignments.facultyId, faculty.id))
    .all();

    const facultyList = await db.select().from(faculty).all();
    const venueList = await db.select().from(venues).all();
    
    // Maps for fast lookup
    const workspaceMap = new Map(allWorkspaces.map(w => [w.id, w]));
    const compMap = new Map(allComponents.map(c => [c.id, c]));
    const facultyMap = new Map(facultyList.map(f => [f.id, f.name]));
    const venueMap = new Map(venueList.map(v => [v.id, v.name]));

    // Resolvers for historical assignments
    const getActiveVenue = (componentId: number, currentDateStr: string) => {
      const assignments = allVenueAssignments.filter(a => a.componentId === componentId);
      let active = null;
      for (const a of assignments) {
        const fromDate = a.effectiveFrom ? a.effectiveFrom.split('T')[0] : '';
        const untilDate = a.effectiveUntil ? a.effectiveUntil.split('T')[0] : null;
        if (fromDate <= currentDateStr && (!untilDate || untilDate >= currentDateStr)) {
          if (!active || a.effectiveFrom > active.effectiveFrom) {
            active = a;
          }
        }
      }
      return active ? active.venueName : undefined;
    };

    const getActiveFaculty = (componentId: number, currentDateStr: string, fallbackFacultyId: number | null) => {
      const assignments = allFacultyAssignments.filter(a => a.componentId === componentId);
      let active = null;
      for (const a of assignments) {
        const fromDate = a.effectiveFrom ? a.effectiveFrom.split('T')[0] : '';
        const untilDate = a.effectiveUntil ? a.effectiveUntil.split('T')[0] : null;
        if (fromDate <= currentDateStr && (!untilDate || untilDate >= currentDateStr)) {
          if (!active || a.effectiveFrom > active.effectiveFrom) {
            active = a;
          }
        }
      }
      if (active) return active.facultyName;
      if (fallbackFacultyId) return facultyMap.get(fallbackFacultyId) || undefined;
      return undefined;
    };

    // 2. Expand recurring schedules into dates
    let current = new Date(start);
    while (current <= end) {
      const currentDayOfWeek = current.getDay(); // 0=Sun, 1=Mon
      const currentDateStr = getLocalDateString(current);

      for (const rec of allRecurring) {
        if (rec.dayOfWeek === currentDayOfWeek) {
          if (rec.effectiveStartDate && currentDateStr < rec.effectiveStartDate) continue;
          if (rec.effectiveEndDate && currentDateStr > rec.effectiveEndDate) continue;

          const comp = compMap.get(rec.componentId);
          if (!comp) continue;
          const ws = workspaceMap.get(comp.workspaceId);
          if (!ws) continue;

          const venueName = getActiveVenue(comp.id, currentDateStr);
          const facultyName = getActiveFaculty(comp.id, currentDateStr, comp.facultyId);

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
            venueName: venueName,
            facultyName: facultyName,
            isException: false,
            // We temporarily store the recurring schedule id to match exceptions accurately
            _recurringScheduleId: rec.id 
          } as any);
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
        const index = occurrences.findIndex((o: any) => 
          o._recurringScheduleId === ex.recurringScheduleId && 
          o.date === ex.specificDate && 
          !o.isException
        );
        if (index !== -1) occurrences.splice(index, 1);
      } 
      else if (ex.action === 'move' || ex.action === 'replace') {
        const index = occurrences.findIndex((o: any) => 
          o._recurringScheduleId === ex.recurringScheduleId && 
          o.date === ex.specificDate &&
          !o.isException
        );
        if (index !== -1) {
          occurrences[index].startTime = ex.startTime || occurrences[index].startTime;
          occurrences[index].endTime = ex.endTime || occurrences[index].endTime;
          occurrences[index].isException = true;
          occurrences[index].exceptionAction = ex.action;
          
          if (ex.venueOverrideId) {
            occurrences[index].venueName = venueMap.get(ex.venueOverrideId);
          }
          if (ex.facultyOverrideId) {
            occurrences[index].facultyName = facultyMap.get(ex.facultyOverrideId);
          }
        }
      }
      else if (ex.action === 'extra') {
        const comp = compMap.get(ex.componentId);
        if (!comp) continue;
        const ws = workspaceMap.get(comp.workspaceId);
        if (!ws) continue;
        
        const venueName = ex.venueOverrideId ? venueMap.get(ex.venueOverrideId) : getActiveVenue(comp.id, ex.specificDate);
        const facultyName = ex.facultyOverrideId ? facultyMap.get(ex.facultyOverrideId) : getActiveFaculty(comp.id, ex.specificDate, comp.facultyId);

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

    // Clean up temporary _recurringScheduleId
    occurrences.forEach((o: any) => {
      delete o._recurringScheduleId;
    });

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
