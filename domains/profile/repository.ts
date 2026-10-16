import { db } from '../../core/db/client';
import { students } from './model';
import { NewStudent, Student } from './types';
import { eq } from 'drizzle-orm';
import { semesters } from '../semester/model';
import { atomic } from '../../core/db/atomic';

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

  /**
   * Onboarding's last step, in one transaction: the student and their current
   * semester, which becomes the only active one. Running it again (a double tap,
   * or a profile left over from a crash) updates the same rows instead of adding more.
   */
  static async completeOnboarding(d: { name: string; branch: string; semester: { number: number; type: 'odd' | 'even'; startDate: string; endDate: string } }) {
    return atomic((tx) => {
      const sem = d.semester;
      const old = tx.select().from(semesters).where(eq(semesters.number, sem.number)).get();
      tx.update(semesters).set({ isActive: false }).run();
      const semester = old
        ? tx.update(semesters).set({ type: sem.type, startDate: sem.startDate, endDate: sem.endDate, isActive: true }).where(eq(semesters.id, old.id)).returning().get()
        : tx.insert(semesters).values({ number: sem.number, type: sem.type, startDate: sem.startDate, endDate: sem.endDate, isActive: true }).returning().get();
      const me = tx.select({ id: students.id }).from(students).limit(1).get();
      const student = me
        ? tx.update(students).set({ name: d.name, branch: d.branch, currentSemester: sem.number }).where(eq(students.id, me.id)).returning().get()
        : tx.insert(students).values({ name: d.name, branch: d.branch, currentSemester: sem.number }).returning().get();
      return { student, semester };
    });
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
