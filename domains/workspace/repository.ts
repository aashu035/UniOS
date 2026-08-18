import { db } from '../../core/db/client';
import { workspaces, workspaceTimeline } from './model';
import { eq, desc, sql, like, inArray } from 'drizzle-orm';
import { faculty } from '../faculty/model';
import { venues } from '../venue/model';
import { semesters } from '../semester/model';

export class WorkspaceRepository {
  static async getAllWorkspaces() {
    return await db.select({
      id: workspaces.id,
      name: workspaces.name,
      code: workspaces.code,
      color: workspaces.color,
      credits: workspaces.credits,
      targetAttendance: workspaces.targetAttendance,
    }).from(workspaces);
  }

  static async getWorkspaceById(id: number) {
    // Backward-compatible wrapper — delegates to getCompleteWorkspace
    return await this.getCompleteWorkspace(id);
  }

  /**
   * Returns a complete view of a workspace:
   * - workspace row
   * - components (theory/lab/tutorial) with active faculty and venue resolved
   * - recurring schedules per component
   * - legacy `faculty` field (resolved from the first component's active assignment)
   * - legacy `venue` field (resolved from the first component's active venue assignment)
   */
  static async getCompleteWorkspace(id: number) {
    const { courseComponents, componentVenueAssignments, componentFacultyAssignments } = require('./model');
    const { recurringSchedules } = require('../calendar/model');
    const { attendance } = require('../attendance/model');
    const { calculateAttendanceMetrics } = require('../../core/utils/attendance');

    // 1. Workspace row
    const workspace = await db.select().from(workspaces).where(eq(workspaces.id, id)).get();
    if (!workspace) return null;

    // 2. Components
    const components = await db.select().from(courseComponents).where(eq(courseComponents.workspaceId, id)).all();

    // 3. All venue assignments for these components
    const componentIds = components.map((c: any) => c.id);
    const allVenueAssignments = componentIds.length > 0
      ? await db.select({
          id: componentVenueAssignments.id,
          componentId: componentVenueAssignments.componentId,
          venueId: componentVenueAssignments.venueId,
          venueName: venues.name,
          effectiveFrom: componentVenueAssignments.effectiveFrom,
          effectiveUntil: componentVenueAssignments.effectiveUntil,
        })
        .from(componentVenueAssignments)
        .leftJoin(venues, eq(componentVenueAssignments.venueId, venues.id))
        .where(inArray(componentVenueAssignments.componentId, componentIds))
        .all()
      : [];

    // 4. All faculty assignments for these components
    const allFacultyAssignments = componentIds.length > 0
      ? await db.select({
          id: componentFacultyAssignments.id,
          componentId: componentFacultyAssignments.componentId,
          facultyId: componentFacultyAssignments.facultyId,
          facultyName: faculty.name,
          facultyEmail: faculty.email,
          effectiveFrom: componentFacultyAssignments.effectiveFrom,
          effectiveUntil: componentFacultyAssignments.effectiveUntil,
        })
        .from(componentFacultyAssignments)
        .leftJoin(faculty, eq(componentFacultyAssignments.facultyId, faculty.id))
        .where(inArray(componentFacultyAssignments.componentId, componentIds))
        .all()
      : [];

    // 5. All recurring schedules for these components
    const allSchedules = componentIds.length > 0
      ? await db.select().from(recurringSchedules).where(inArray(recurringSchedules.componentId, componentIds)).all()
      : [];

    // 5.5 All attendance records for these components
    const allAttendance = componentIds.length > 0
      ? await db.select().from(attendance).where(inArray(attendance.componentId, componentIds)).all()
      : [];

    const todayStr = new Date().toISOString().split('T')[0];

    // Resolve active assignment (most recent effectiveFrom that is <= today and effectiveUntil is null or >= today)
    const resolveActive = (assignments: any[], componentId: number) => {
      const relevant = assignments.filter((a: any) => {
        if (a.componentId !== componentId) return false;
        const fromDate = a.effectiveFrom ? a.effectiveFrom.split('T')[0] : '';
        const untilDate = a.effectiveUntil ? a.effectiveUntil.split('T')[0] : null;
        return fromDate <= todayStr && (!untilDate || untilDate >= todayStr);
      });
      if (relevant.length === 0) return null;
      // Pick the one with the most recent effectiveFrom
      relevant.sort((a: any, b: any) => b.effectiveFrom.localeCompare(a.effectiveFrom));
      return relevant[0];
    };

    // 6. Build enriched component list
    const enrichedComponents = components.map((comp: any) => {
      const activeVenue = resolveActive(allVenueAssignments, comp.id);
      const activeFaculty = resolveActive(allFacultyAssignments, comp.id);
      const schedules = allSchedules.filter((s: any) => s.componentId === comp.id);
      const compAttendanceRecords = allAttendance.filter((a: any) => a.componentId === comp.id);

      return {
        ...comp,
        activeVenueName: activeVenue?.venueName ?? null,
        activeVenueId: activeVenue?.venueId ?? null,
        activeFacultyName: activeFaculty?.facultyName ?? null,
        activeFacultyEmail: activeFaculty?.facultyEmail ?? null,
        activeFacultyId: activeFaculty?.facultyId ?? null,
        schedules,
        attendanceMetrics: calculateAttendanceMetrics(compAttendanceRecords),
      };
    });

    // 7. Legacy-compatible faculty/venue (from the first component, typically Theory)
    const primaryComponent = enrichedComponents[0] ?? null;
    const legacyFaculty = primaryComponent
      ? { name: primaryComponent.activeFacultyName, email: primaryComponent.activeFacultyEmail, id: primaryComponent.activeFacultyId }
      : null;
    const legacyVenue = primaryComponent
      ? { name: primaryComponent.activeVenueName, id: primaryComponent.activeVenueId }
      : null;

    return {
      workspace,
      components: enrichedComponents,
      faculty: legacyFaculty,
      venue: legacyVenue,
      // Legacy fields for backward compatibility
      targetAttendance: workspace.targetAttendance,
    };
  }

  static async getTimelineEvents(workspaceId: number) {
    return await db.select()
      .from(workspaceTimeline)
      .where(eq(workspaceTimeline.workspaceId, workspaceId))
      .orderBy(desc(workspaceTimeline.timestamp));
  }

  static async deleteWorkspace(workspaceId: number) {
    const { ResourceRepository } = require('../resource/repository');
    // Fetch resources before deleting the workspace
    const resources = await ResourceRepository.getResourcesForWorkspace(workspaceId);

    // Delete workspace from DB. SQLite PRAGMA foreign_keys = ON handles cascading deletes
    // for tasks, resources, attendance, calendar events, and timeline.
    await db.delete(workspaces).where(eq(workspaces.id, workspaceId));

    // Cleanup managed files
    for (const res of resources) {
      if (res.uri && res.uri.startsWith('file://')) {
        try {
          const FileSystem = require('expo-file-system');
          const fileInfo = await FileSystem.getInfoAsync(res.uri);
          if (fileInfo.exists) {
            await FileSystem.deleteAsync(res.uri);
          }
        } catch (err) {
          console.warn('Failed to delete managed file during workspace cascade:', res.uri, err);
        }
      }
    }
  }

  // --- ENTITY RESOLUTION ---
  
  private static async resolveEntity(tx: any, table: any, rawName?: string) {
    if (!rawName || !rawName.trim()) return null;
    const name = rawName.trim();
    const canonicalName = name.toLowerCase();
    
    // Exact canonical match
    const matches = await tx.select().from(table).all();
    const exactMatches = matches.filter((m: any) => m.name.toLowerCase() === canonicalName);
    
    if (exactMatches.length > 1) {
      throw new Error('AMBIGUOUS_ENTITY_RESOLUTION');
    }
    
    if (exactMatches.length === 1) {
      return exactMatches[0].id;
    }
    
    // Create new
    const result = await tx.insert(table).values({ name }).returning().get();
    return result.id;
  }

  static async resolveFaculty(tx: any, name?: string) {
    return this.resolveEntity(tx, faculty, name);
  }

  static async resolveVenue(tx: any, name?: string) {
    return this.resolveEntity(tx, venues, name);
  }

  // --- CRUD ---

  static async buildCompleteWorkspace(data: {
    name: string;
    code?: string;
    credits?: number;
    color?: string;
    icon?: string;
    components: Array<{
      type: 'theory' | 'lab' | 'tutorial';
      facultyName?: string;
      venueName?: string;
      durationMinutes: number;
      sessions: Array<{
        dayOfWeek: number;
        startTime: string;
        endTime: string;
      }>;
    }>;
  }) {
    // Domain Validations BEFORE Transaction
    if (!data.components || data.components.length === 0) {
      throw new Error('Course must have at least one component (Theory).');
    }

    const types = data.components.map(c => c.type);
    if (!types.includes('theory')) {
      throw new Error('Theory component is mandatory.');
    }

    if (types.length > 2) {
      throw new Error('Invalid component combination. Allowed: Theory, Theory + Lab, Theory + Tutorial.');
    }
    if (types.includes('lab') && types.includes('tutorial')) {
      throw new Error('Invalid component combination. Cannot have both Lab and Tutorial.');
    }

    // Time & Overlap Validation
    for (const comp of data.components) {
      if (comp.type === 'theory' && comp.durationMinutes !== 60) throw new Error('Theory must be 60 mins.');
      if (comp.type === 'tutorial' && comp.durationMinutes !== 60) throw new Error('Tutorial must be 60 mins.');
      if (comp.type === 'lab' && comp.durationMinutes !== 120) throw new Error('Lab must be 120 mins.');

      // Check session overlaps
      for (let i = 0; i < comp.sessions.length; i++) {
        const s1 = comp.sessions[i];
        if (s1.startTime >= s1.endTime) {
          throw new Error(`Invalid session time: ${s1.startTime} >= ${s1.endTime}`);
        }
        for (let j = i + 1; j < comp.sessions.length; j++) {
          const s2 = comp.sessions[j];
          if (s1.dayOfWeek === s2.dayOfWeek) {
            // overlap = newStart < existingEnd AND newEnd > existingStart
            if (s2.startTime < s1.endTime && s2.endTime > s1.startTime) {
              // We're converting overlap errors to soft warnings in the UI layer. 
              // The repository layer shouldn't enforce a hard block if we want soft warnings!
              // But we can throw a specific error code if we want the UI to catch it.
              // Actually, the user specifically requested overlap should be a warning.
              // So I'll remove the hard throw here, and let the UI handle the warning,
              // or throw a specific error that the UI can choose to ignore on "Proceed Anyway".
              // Let's just remove the hard block in the DB layer, as overlap is logically allowed (e.g. reappearing).
            }
          }
        }
      }
    }

    return db.transaction(async (tx) => {
      // 1. Resolve Active Semester
      let activeSemester = await tx.select().from(semesters).where(eq(semesters.isActive, true)).get();
      if (!activeSemester) {
        throw new Error('NO_ACTIVE_SEMESTER'); // Do not auto-create
      }

      // 2. Create Workspace
      const workspace = await tx.insert(workspaces).values({
        semesterId: activeSemester.id,
        name: data.name.trim(),
        code: data.code?.trim() || null,
        credits: data.credits ?? 3,
        color: data.color || '#6C5CE7',
        icon: data.icon || 'book',
      }).returning().get();
      
      const { courseComponents, componentVenueAssignments, componentFacultyAssignments } = require('./model');
      const { recurringSchedules } = require('../calendar/model');

      // 3. Create Components and their Sessions
      for (const compDef of data.components) {
        const facultyId = await this.resolveFaculty(tx, compDef.facultyName);
        const venueId = await this.resolveVenue(tx, compDef.venueName);

        const component = await tx.insert(courseComponents).values({
          workspaceId: workspace.id,
          type: compDef.type,
          facultyId: facultyId,
          durationMinutes: compDef.durationMinutes,
        }).returning().get();

        const nowIso = new Date().toISOString().split('T')[0];

        if (venueId) {
          await tx.insert(componentVenueAssignments).values({
            componentId: component.id,
            venueId: venueId,
            effectiveFrom: nowIso
          });
        }
        
        if (facultyId) {
          await tx.insert(componentFacultyAssignments).values({
            componentId: component.id,
            facultyId: facultyId,
            effectiveFrom: nowIso
          });
        }

        // Insert recurring sessions for this component
        for (const session of compDef.sessions) {
          await tx.insert(recurringSchedules).values({
            componentId: component.id,
            dayOfWeek: session.dayOfWeek,
            startTime: session.startTime,
            endTime: session.endTime,
          });
        }
      }

      return workspace;
    });
  }

  // --- EDIT LIFECYCLE OPERATIONS ---

  static async updateCourseIdentity(id: number, data: { name?: string; code?: string; credits?: number; color?: string; targetAttendance?: number; icon?: string }) {
    return db.transaction(async (tx) => {
      const updates: any = {};
      if (data.name !== undefined) updates.name = data.name.trim();
      if (data.code !== undefined) updates.code = data.code?.trim() || null;
      if (data.credits !== undefined) updates.credits = data.credits;
      if (data.color !== undefined) updates.color = data.color;
      if (data.targetAttendance !== undefined) updates.targetAttendance = data.targetAttendance;
      if (data.icon !== undefined) updates.icon = data.icon;

      if (Object.keys(updates).length > 0) {
        return await tx.update(workspaces).set(updates).where(eq(workspaces.id, id)).returning().get();
      }
      return await tx.select().from(workspaces).where(eq(workspaces.id, id)).get();
    });
  }

  static async updateComponent(id: number, data: { assessmentAllocation?: number; type?: 'theory' | 'lab' | 'tutorial'; durationMinutes?: number }) {
    const { courseComponents } = require('./model');
    return db.transaction(async (tx) => {
      const current = await tx.select().from(courseComponents).where(eq(courseComponents.id, id)).get();
      if (!current) throw new Error('Component not found');

      const updates: any = {};
      if (data.assessmentAllocation !== undefined) updates.assessmentAllocation = data.assessmentAllocation;

      if (data.type !== undefined) {
        updates.type = data.type;
        // Derive locked duration
        if (data.type === 'theory' || data.type === 'tutorial') updates.durationMinutes = 60;
        else if (data.type === 'lab') updates.durationMinutes = 120;
      }

      if (data.durationMinutes !== undefined) {
        // Enforce invariants
        const targetType = updates.type ?? current.type;
        if ((targetType === 'theory' || targetType === 'tutorial') && data.durationMinutes !== 60) {
          throw new Error(`${targetType} must be 60 minutes`);
        }
        if (targetType === 'lab' && data.durationMinutes !== 120) {
          throw new Error('lab must be 120 minutes');
        }
        updates.durationMinutes = data.durationMinutes;
      }

      if (Object.keys(updates).length > 0) {
        return await tx.update(courseComponents).set(updates).where(eq(courseComponents.id, id)).returning().get();
      }
      return current;
    });
  }

  static async updateRecurringSchedule(id: number, data: { dayOfWeek?: number; startTime?: string; endTime?: string }) {
    const { recurringSchedules } = require('../calendar/model');
    return db.transaction(async (tx) => {
      const current = await tx.select().from(recurringSchedules).where(eq(recurringSchedules.id, id)).get();
      if (!current) throw new Error('Schedule not found');

      const updates: any = {};
      const newDay = data.dayOfWeek ?? current.dayOfWeek;
      const newStart = data.startTime ?? current.startTime;
      const newEnd = data.endTime ?? current.endTime;

      if (newStart >= newEnd) {
        throw new Error(`Invalid session time: ${newStart} >= ${newEnd}`);
      }

      // Check overlap against other sessions in the same component
      const others = await tx.select().from(recurringSchedules).where(eq(recurringSchedules.componentId, current.componentId)).all();
      for (const other of others) {
        if (other.id === id) continue; // Skip self
        if (other.dayOfWeek === newDay) {
          if (other.startTime < newEnd && other.endTime > newStart) {
            throw new Error(`Overlapping sessions detected on day ${newDay}`);
          }
        }
      }

      if (data.dayOfWeek !== undefined) updates.dayOfWeek = data.dayOfWeek;
      if (data.startTime !== undefined) updates.startTime = data.startTime;
      if (data.endTime !== undefined) updates.endTime = data.endTime;
      
      if (Object.keys(updates).length > 0) {
        return await tx.update(recurringSchedules).set(updates).where(eq(recurringSchedules.id, id)).returning().get();
      }
      return current;
    });
  }

  static async changeHistoricalVenue(componentId: number, venueName: string, effectiveFromDateStr: string) {
    const { componentVenueAssignments } = require('./model');
    return db.transaction(async (tx) => {
      // 1. Resolve new venue
      const venueId = await this.resolveVenue(tx, venueName);
      if (!venueId) return;

      // Ensure date format is YYYY-MM-DD
      const dateOnly = effectiveFromDateStr.split('T')[0];
      const d = new Date(dateOnly);
      d.setDate(d.getDate() - 1);
      const effectiveUntilStr = d.toISOString().split('T')[0];

      // 2. End previous active assignment
      const currentActive = await tx.select().from(componentVenueAssignments)
        .where(
          sql`${componentVenueAssignments.componentId} = ${componentId} AND ${componentVenueAssignments.effectiveUntil} IS NULL`
        ).get();

      if (currentActive) {
        await tx.update(componentVenueAssignments)
          .set({ effectiveUntil: effectiveUntilStr })
          .where(eq(componentVenueAssignments.id, currentActive.id));
      }

      // 3. Create new assignment
      await tx.insert(componentVenueAssignments).values({
        componentId,
        venueId,
        effectiveFrom: dateOnly
      });
    });
  }

  static async changeHistoricalFaculty(componentId: number, facultyName: string, effectiveFromDateStr: string) {
    const { componentFacultyAssignments } = require('./model');
    return db.transaction(async (tx) => {
      const facultyId = await this.resolveFaculty(tx, facultyName);
      if (!facultyId) return;

      const dateOnly = effectiveFromDateStr.split('T')[0];
      const d = new Date(dateOnly);
      d.setDate(d.getDate() - 1);
      const effectiveUntilStr = d.toISOString().split('T')[0];

      const currentActive = await tx.select().from(componentFacultyAssignments)
        .where(
          sql`${componentFacultyAssignments.componentId} = ${componentId} AND ${componentFacultyAssignments.effectiveUntil} IS NULL`
        ).get();

      if (currentActive) {
        await tx.update(componentFacultyAssignments)
          .set({ effectiveUntil: effectiveUntilStr })
          .where(eq(componentFacultyAssignments.id, currentActive.id));
      }

      await tx.insert(componentFacultyAssignments).values({
        componentId,
        facultyId,
        effectiveFrom: dateOnly
      });
    });
  }
}
