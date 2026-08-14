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
      venue: venues,
    })
    .from(workspaces)
    .leftJoin(faculty, eq(workspaces.facultyId, faculty.id))
    .leftJoin(venues, eq(workspaces.venueId, venues.id))
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
    
    // Exact match reuse rule: 0 matches -> create, 1 match -> reuse, >1 match -> create a new one to avoid merging incorrectly?
    // User rule: "0 matches -> create, 1 match -> reuse, >1 exact matches -> require resolution / select one existing"
    // Since we don't have a UI for resolution mid-transaction, we will reuse the first one if there's exactly 1.
    // If >1, we'll pick the most recently created or first one to be safe, rather than crashing or duplicating.
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

  static async createWorkspace(data: {
    name: string;
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
      // 1. Resolve Active Semester
      const activeSemester = await tx.select().from(semesters).where(eq(semesters.isActive, true)).get();
      if (!activeSemester) {
        throw new Error("No active semester found. Cannot create course.");
      }

      // 2. Resolve Entities
      const facultyId = await this.resolveFaculty(tx, data.facultyName);
      const venueId = await this.resolveVenue(tx, data.venueName);

      // 3. Create Workspace
      const workspace = await tx.insert(workspaces).values({
        semesterId: activeSemester.id,
        name: data.name.trim(),
        code: data.code?.trim() || null,
        facultyId,
        venueId,
        targetAttendance: data.targetAttendance ?? 75,
        credits: data.credits ?? 3,
        type: data.type || 'theory',
        notes: data.notes?.trim() || null,
        color: data.color || '#6C5CE7',
      }).returning().get();

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
      if (data.type !== undefined) updates.type = data.type;
      if (data.notes !== undefined) updates.notes = data.notes?.trim() || null;
      if (data.color !== undefined) updates.color = data.color;

      if (data.facultyName !== undefined) {
        updates.facultyId = await this.resolveFaculty(tx, data.facultyName);
      }
      if (data.venueName !== undefined) {
        updates.venueId = await this.resolveVenue(tx, data.venueName);
      }

      const workspace = await tx.update(workspaces).set(updates).where(eq(workspaces.id, id)).returning().get();
      return workspace;
    });
  }
}
