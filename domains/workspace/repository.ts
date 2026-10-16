import { db } from '../../core/db/client';
import { atomic } from '../../core/db/atomic';
import { addDays } from '../academic/logic';
import { workspaces, workspaceTimeline } from './model';
import { eq, desc, sql, like, inArray, count } from 'drizzle-orm';
import { getLocalDateString } from '../../core/utils/date';
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

  static async deleteWorkspace(workspaceId: number) {
    const { ResourceRepository } = require('../resource/repository');
    // Fetch resources before deleting the workspace
    const resources = await ResourceRepository.getResourcesForWorkspace(workspaceId);

    // Delete workspace from DB. SQLite PRAGMA foreign_keys = ON handles cascading deletes
    // for tasks, resources, attendance, calendar events, and timeline.
    await db.delete(workspaces).where(eq(workspaces.id, workspaceId));

    // Files are removed after their rows, and only when no other course still uses them.
    for (const res of resources) await ResourceRepository.removeFileIfUnused(res.uri);
  }

  // --- ENTITY RESOLUTION ---
  
  /**
   * The id of the teacher or room called `rawName`, created if new. Case and
   * repeated spaces don't matter ("dr.  RD" is "Dr. RD"). If an old backup left
   * two rows with the same name, the oldest is reused rather than refusing.
   * Synchronous so it can run inside `atomic()`.
   */
  private static resolveEntity(tx: any, table: any, rawName?: string): number | null {
    const name = (rawName ?? '').trim().replace(/\s+/g, ' ');
    if (!name) return null;
    const key = name.toLowerCase();
    const match = (tx.select().from(table).all() as Array<{ id: number; name: string }>)
      .filter((m) => m.name.trim().replace(/\s+/g, ' ').toLowerCase() === key)
      .sort((a, b) => a.id - b.id)[0];
    if (match) return match.id;
    return tx.insert(table).values({ name }).returning().get().id;
  }

  static resolveFaculty(tx: any, name?: string) {
    return this.resolveEntity(tx, faculty, name);
  }

  static resolveVenue(tx: any, name?: string) {
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

    // Duration and time validation
    for (const comp of data.components) {
      if (comp.type === 'theory' && comp.durationMinutes !== 60) throw new Error('Theory must be 60 mins.');
      if (comp.type === 'tutorial' && comp.durationMinutes !== 60) throw new Error('Tutorial must be 60 mins.');
      if (comp.type === 'lab' && comp.durationMinutes !== 120) throw new Error('Lab must be 120 mins.');

      // Clashes are warned about in setup (findClashes), not blocked here.
      for (const s1 of comp.sessions) {
        if (s1.startTime >= s1.endTime) {
          throw new Error(`Invalid session time: ${s1.startTime} >= ${s1.endTime}`);
        }
      }
    }

    return atomic((tx) => {
      // 1. Resolve Active Semester
      let activeSemester = tx.select().from(semesters).where(eq(semesters.isActive, true)).get();
      if (!activeSemester) {
        throw new Error('NO_ACTIVE_SEMESTER'); // Do not auto-create
      }

      // 2. Create Workspace
      const workspace = tx.insert(workspaces).values({
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
        const facultyId = this.resolveFaculty(tx, compDef.facultyName);
        const venueId = this.resolveVenue(tx, compDef.venueName);

        const component = tx.insert(courseComponents).values({
          workspaceId: workspace.id,
          type: compDef.type,
          facultyId: facultyId,
          durationMinutes: compDef.durationMinutes,
        }).returning().get();

        const initialEffectiveFrom = activeSemester.startDate || getLocalDateString(new Date());

        if (venueId) {
          tx.insert(componentVenueAssignments).values({
            componentId: component.id,
            venueId: venueId,
            effectiveFrom: initialEffectiveFrom
          }).run();
        }
        
        if (facultyId) {
          tx.insert(componentFacultyAssignments).values({
            componentId: component.id,
            facultyId: facultyId,
            effectiveFrom: initialEffectiveFrom
          }).run();
        }

        // Insert recurring sessions for this component
        for (const session of compDef.sessions) {
          tx.insert(recurringSchedules).values({
            componentId: component.id,
            dayOfWeek: session.dayOfWeek,
            startTime: session.startTime,
            endTime: session.endTime,
          }).run();
        }
      }

      return workspace;
    });
  }

  // --- EDIT LIFECYCLE OPERATIONS ---

  static async updateCourseIdentity(id: number, data: { name?: string; code?: string; credits?: number; color?: string; targetAttendance?: number; icon?: string; notes?: string | null }) {
    return atomic((tx) => {
      const updates: any = {};
      if (data.name !== undefined) updates.name = data.name.trim();
      if (data.code !== undefined) updates.code = data.code?.trim() || null;
      if (data.credits !== undefined) updates.credits = data.credits;
      if (data.color !== undefined) updates.color = data.color;
      if (data.targetAttendance !== undefined) updates.targetAttendance = data.targetAttendance;
      if (data.icon !== undefined) updates.icon = data.icon;
      if (data.notes !== undefined) updates.notes = data.notes?.trim() || null;

      if (Object.keys(updates).length > 0) {
        return tx.update(workspaces).set(updates).where(eq(workspaces.id, id)).returning().get();
      }
      return tx.select().from(workspaces).where(eq(workspaces.id, id)).get();
    });
  }

  static async changeHistoricalVenue(componentId: number, venueName: string, effectiveFromDateStr: string) {
    const { componentVenueAssignments } = require('./model');
    return atomic((tx) => {
      // 1. Resolve new venue
      const venueId = this.resolveVenue(tx, venueName);
      if (!venueId) return;

      // The old assignment ends the day before (local days; never new Date('YYYY-MM-DD')).
      const dateOnly = effectiveFromDateStr.split('T')[0];
      const effectiveUntilStr = addDays(dateOnly, -1);

      // 2. End previous active assignment
      const currentActive = tx.select().from(componentVenueAssignments)
        .where(
          sql`${componentVenueAssignments.componentId} = ${componentId} AND ${componentVenueAssignments.effectiveUntil} IS NULL`
        ).get();

      if (currentActive) {
        tx.update(componentVenueAssignments)
          .set({ effectiveUntil: effectiveUntilStr })
          .where(eq(componentVenueAssignments.id, currentActive.id)).run();
      }

      // 3. Create new assignment
      tx.insert(componentVenueAssignments).values({
        componentId,
        venueId,
        effectiveFrom: dateOnly
      }).run();
    });
  }

  static async changeHistoricalFaculty(componentId: number, facultyName: string, effectiveFromDateStr: string) {
    const { componentFacultyAssignments } = require('./model');
    return atomic((tx) => {
      const facultyId = this.resolveFaculty(tx, facultyName);
      if (!facultyId) return;

      // The old assignment ends the day before (local days; never new Date('YYYY-MM-DD')).
      const dateOnly = effectiveFromDateStr.split('T')[0];
      const effectiveUntilStr = addDays(dateOnly, -1);

      const currentActive = tx.select().from(componentFacultyAssignments)
        .where(
          sql`${componentFacultyAssignments.componentId} = ${componentId} AND ${componentFacultyAssignments.effectiveUntil} IS NULL`
        ).get();

      if (currentActive) {
        tx.update(componentFacultyAssignments)
          .set({ effectiveUntil: effectiveUntilStr })
          .where(eq(componentFacultyAssignments.id, currentActive.id)).run();
      }

      tx.insert(componentFacultyAssignments).values({
        componentId,
        facultyId,
        effectiveFrom: dateOnly
      }).run();
    });
  }
}
