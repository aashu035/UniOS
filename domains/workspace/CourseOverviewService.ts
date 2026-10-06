import { db } from '../../core/db/client';
import { workspaces, courseComponents } from './model';
import { recurringSchedules } from '../calendar/model';
import { attendance } from '../attendance/model';
import { eq, inArray } from 'drizzle-orm';
import { calculateAttendanceMetrics } from '../../core/utils/attendance';
import { getLocalDateString } from '../../core/utils/date';
import { AssignmentResolutionService } from './AssignmentResolutionService';

export type CourseOverview = {
  course: {
    id: number;
    semesterId: number | null;
    name: string;
    code: string | null;
    credits: number | null;
    color: string;
    iconId: string | null;
    targetAttendance: number;
    notes: string | null;
  };

  components: Array<{
    id: number;
    type: 'theory' | 'lab' | 'tutorial';
    durationMinutes: number;

    activeFaculty: {
      id: number;
      name: string;
    } | null;

    activeVenue: {
      id: number;
      name: string;
    } | null;

    schedules: Array<{
      id: number;
      dayOfWeek: number;
      startTime: string;
      endTime: string;
    }>;

    attendance: {
      present: number;
      absent: number;
      exempt: number;
      holiday: number;
      cancelled: number;
      actualPercentage: number | null;
    };
  }>;

  attendance: {
    present: number;
    absent: number;
    exempt: number;
    denominator: number;
    actualPercentage: number | null;
    targetPercentage: number;
  };
};

export class CourseOverviewService {
  static async getCourseDetail(id: number): Promise<CourseOverview | null> {
    const workspace = await db.select().from(workspaces).where(eq(workspaces.id, id)).get();
    if (!workspace) return null;

    const components = await db.select().from(courseComponents).where(eq(courseComponents.workspaceId, id)).all();
    const componentIds = components.map((c: any) => c.id);

    const allVenueAssignments = await AssignmentResolutionService.fetchAllVenueAssignments(componentIds);
    const allFacultyAssignments = await AssignmentResolutionService.fetchAllFacultyAssignments(componentIds);

    const allSchedules = componentIds.length > 0
      ? await db.select().from(recurringSchedules).where(inArray(recurringSchedules.componentId, componentIds)).all()
      : [];

    const allAttendance = componentIds.length > 0
      ? await db.select().from(attendance).where(inArray(attendance.componentId, componentIds)).all()
      : [];

    const todayStr = getLocalDateString(new Date());

    const enrichedComponents = components.map((comp: any) => {
      const activeVenue = AssignmentResolutionService.getActiveVenueAssignment(allVenueAssignments, comp.id, todayStr);
      const activeFaculty = AssignmentResolutionService.getActiveFacultyAssignment(allFacultyAssignments, comp.id, todayStr, comp.facultyId);
      
      const schedules = allSchedules.filter((s: any) => s.componentId === comp.id).map((s: any) => ({
        id: s.id,
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
      }));

      const compAttendanceRecords = allAttendance.filter((a: any) => a.componentId === comp.id);
      const metrics = calculateAttendanceMetrics(compAttendanceRecords);

      return {
        id: comp.id,
        type: comp.type,
        durationMinutes: comp.durationMinutes,
        activeFaculty,
        activeVenue,
        schedules,
        attendance: {
          present: metrics.present,
          absent: metrics.absent,
          exempt: metrics.exempt,
          holiday: 0,
          cancelled: 0,
          actualPercentage: metrics.percentage,
        }
      };
    });

    const totalMetrics = calculateAttendanceMetrics(allAttendance);

    return {
      course: {
        id: workspace.id,
        semesterId: workspace.semesterId,
        name: workspace.name,
        code: workspace.code,
        credits: workspace.credits,
        color: workspace.color || '#6C5CE7',
        iconId: workspace.icon,
        targetAttendance: workspace.targetAttendance ?? 75,
        notes: workspace.notes ?? null,
      },
      components: enrichedComponents,
      attendance: {
        present: totalMetrics.present,
        absent: totalMetrics.absent,
        exempt: totalMetrics.exempt,
        denominator: totalMetrics.total,
        actualPercentage: totalMetrics.percentage,
        targetPercentage: workspace.targetAttendance ?? 75,
      }
    };
  }
}
