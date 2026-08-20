import { db } from '../../core/db/client';
import { componentVenueAssignments, componentFacultyAssignments } from './model';
import { venues } from '../venue/model';
import { faculty } from '../faculty/model';
import { eq, inArray } from 'drizzle-orm';

export type ResolvedVenue = { id: number; name: string } | null;
export type ResolvedFaculty = { id: number; name: string; email: string | null } | null;

export class AssignmentResolutionService {
  /**
   * Given a list of venue assignments for a component, returns the active assignment for the given date.
   * Deterministic tie-breaking: latest effectiveFrom, then highest ID.
   */
  static getActiveVenueAssignment(assignments: any[], componentId: number, targetDateStr: string): ResolvedVenue {
    const relevant = assignments.filter((a: any) => {
      if (a.componentId !== componentId) return false;
      const fromDate = a.effectiveFrom ? a.effectiveFrom.split('T')[0] : '';
      const untilDate = a.effectiveUntil ? a.effectiveUntil.split('T')[0] : null;
      return fromDate <= targetDateStr && (!untilDate || untilDate >= targetDateStr);
    });

    if (relevant.length === 0) return null;

    relevant.sort((a: any, b: any) => {
      if (b.effectiveFrom !== a.effectiveFrom) {
        return b.effectiveFrom.localeCompare(a.effectiveFrom);
      }
      return b.id - a.id; // tie-breaker
    });

    const active = relevant[0];
    return {
      id: active.venueId,
      name: active.venueName,
    };
  }

  /**
   * Given a list of faculty assignments for a component, returns the active assignment for the given date.
   * Deterministic tie-breaking: latest effectiveFrom, then highest ID.
   */
  static getActiveFacultyAssignment(assignments: any[], componentId: number, targetDateStr: string, fallbackFacultyId: number | null = null, fallbackFacultyName: string | null = null): ResolvedFaculty {
    const relevant = assignments.filter((a: any) => {
      if (a.componentId !== componentId) return false;
      const fromDate = a.effectiveFrom ? a.effectiveFrom.split('T')[0] : '';
      const untilDate = a.effectiveUntil ? a.effectiveUntil.split('T')[0] : null;
      return fromDate <= targetDateStr && (!untilDate || untilDate >= targetDateStr);
    });

    if (relevant.length === 0) {
      if (fallbackFacultyId && fallbackFacultyName) {
        return { id: fallbackFacultyId, name: fallbackFacultyName, email: null };
      }
      return null;
    }

    relevant.sort((a: any, b: any) => {
      if (b.effectiveFrom !== a.effectiveFrom) {
        return b.effectiveFrom.localeCompare(a.effectiveFrom);
      }
      return b.id - a.id; // tie-breaker
    });

    const active = relevant[0];
    return {
      id: active.facultyId,
      name: active.facultyName,
      email: active.facultyEmail || null,
    };
  }

  static async fetchAllVenueAssignments(componentIds: number[]) {
    if (componentIds.length === 0) return [];
    return await db.select({
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
    .all();
  }

  static async fetchAllFacultyAssignments(componentIds: number[]) {
    if (componentIds.length === 0) return [];
    return await db.select({
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
    .all();
  }
}
