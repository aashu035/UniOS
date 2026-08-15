import { db } from '../../core/db/client';
import { workspaces, workspaceTimeline } from './model';
import { eq, desc, sql, like } from 'drizzle-orm';
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
    const result = await db.select({
      workspace: workspaces,
      faculty: faculty,
    })
    .from(workspaces)
    .leftJoin(faculty, eq(workspaces.defaultFacultyId, faculty.id))
    .where(eq(workspaces.id, id))
    .limit(1);

    return result[0] || null;
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
    // Try to find exact matches (case-insensitive)
    const matches = await tx.select().from(table).where(like(table.name, name)).all();
    
    if (matches.length > 0) {
      return matches[0].id;
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
    return db.transaction(async (tx) => {
      // 1. Resolve Active Semester
      let activeSemester = await tx.select().from(semesters).where(eq(semesters.isActive, true)).get();
      if (!activeSemester) {
        activeSemester = await tx.insert(semesters).values({
          number: 1,
          name: 'Semester 1',
          isActive: true,
          startDate: new Date().toISOString(),
        }).returning().get();
      }

      // 2. Create Workspace
      const workspace = await tx.insert(workspaces).values({
        semesterId: activeSemester.id,
        name: data.name.trim(),
        code: data.code?.trim() || null,
        credits: data.credits ?? 3,
        color: data.color || '#6C5CE7',
      }).returning().get();
      
      const { courseComponents, componentVenueAssignments } = require('./model');
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

        if (venueId) {
          await tx.insert(componentVenueAssignments).values({
            componentId: component.id,
            venueId: venueId,
            effectiveFrom: new Date().toISOString()
          });
        }

        // Insert recurring sessions for this component
        for (const session of compDef.sessions) {
          await tx.insert(recurringSchedules).values({
            componentId: component.id,
            dayOfWeek: session.dayOfWeek,
            startTime: session.startTime,
            endTime: session.endTime,
            // venueOverrideId could go here if needed, but per specs we inherit from component
          });
        }
      }

      return workspace;
    });
  }

  static async updateWorkspace(id: number, data: {
    name?: string;
    code?: string;
    facultyName?: string;
    venueName?: string;
    targetAttendance?: number;
    credits?: number;
    type?: string;
    notes?: string;
    color?: string;
  }) {
    return db.transaction(async (tx) => {
      const updates: any = {};
      if (data.name !== undefined) updates.name = data.name.trim();
      if (data.code !== undefined) updates.code = data.code?.trim() || null;
      if (data.targetAttendance !== undefined) updates.targetAttendance = data.targetAttendance;
      if (data.credits !== undefined) updates.credits = data.credits;
      if (data.notes !== undefined) updates.notes = data.notes?.trim() || null;
      if (data.color !== undefined) updates.color = data.color;

      if (data.facultyName !== undefined) {
        updates.defaultFacultyId = await this.resolveFaculty(tx, data.facultyName);
      }

      // We do not handle venue/component updates here yet, this is just for basic compilation
      if (Object.keys(updates).length > 0) {
        return await tx.update(workspaces).set(updates).where(eq(workspaces.id, id)).returning().get();
      }
      return await tx.select().from(workspaces).where(eq(workspaces.id, id)).get();
    });
  }
}
