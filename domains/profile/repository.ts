import { db } from '../../core/db/client';
import { students } from './model';
import { NewStudent, Student } from './types';
import { eq } from 'drizzle-orm';
import { semesters } from '../semester/model';

export class ProfileRepository {
  static async getProfile(): Promise<Student & { avatar?: string | null }> {
    const result = await db.select().from(students).limit(1);
    if (!result[0]) return null as any;
    const profile = result[0];
    return { ...profile, avatar: profile.heroPortraitUri };
  }

  static async createProfile(profile: NewStudent & { avatar?: string | null }): Promise<Student & { avatar?: string | null }> {
    const dbProfile = { ...profile };
    if ('avatar' in dbProfile) {
      dbProfile.heroPortraitUri = dbProfile.avatar;
      delete dbProfile.avatar;
    }
    const result = await db.insert(students).values(dbProfile).returning();
    const created = result[0];

    if (profile.currentSemester !== undefined && profile.currentSemester !== null) {
      // Find the corresponding semester to activate
      const existing = await db.select().from(semesters).where(eq(semesters.number, profile.currentSemester)).get();
      if (existing) {
        const { SemesterRepository } = require('../semester/repository');
        await SemesterRepository.activateSemester(existing.id);
      } else {
        // If it doesn't exist, we must create it first, then activate it
        const [createdSemester] = await db.insert(semesters).values({
          number: profile.currentSemester,
          name: `Semester ${profile.currentSemester}`,
          type: profile.currentSemester % 2 === 0 ? 'even' : 'odd',
          isActive: false // Let activateSemester handle activation and sync
        }).returning();
        
        const { SemesterRepository } = require('../semester/repository');
        await SemesterRepository.activateSemester(createdSemester.id);
      }
    }

    return { ...created, avatar: created.heroPortraitUri };
  }

  static async updateProfile(id: number, updates: Partial<NewStudent> & { avatar?: string | null }): Promise<Student & { avatar?: string | null }> {
    const dbUpdates = { ...updates };
    if ('avatar' in dbUpdates) {
      dbUpdates.heroPortraitUri = dbUpdates.avatar;
      delete dbUpdates.avatar;
    }
    const result = await db.update(students)
      .set(dbUpdates)
      .where(eq(students.id, id))
      .returning();

    if (updates.currentSemester !== undefined && updates.currentSemester !== null) {
      // Find the corresponding semester to activate
      const existing = await db.select().from(semesters).where(eq(semesters.number, updates.currentSemester)).get();
      if (existing) {
        const { SemesterRepository } = require('../semester/repository');
        await SemesterRepository.activateSemester(existing.id);
      } else {
        // If it doesn't exist, we must create it first, then activate it
        const [createdSemester] = await db.insert(semesters).values({
          number: updates.currentSemester,
          name: `Semester ${updates.currentSemester}`,
          type: updates.currentSemester % 2 === 0 ? 'even' : 'odd',
          isActive: false // Let activateSemester handle activation and sync
        }).returning();
        
        const { SemesterRepository } = require('../semester/repository');
        await SemesterRepository.activateSemester(createdSemester.id);
      }
    }

    const updated = result[0];
    return { ...updated, avatar: updated.heroPortraitUri };
  }
}
