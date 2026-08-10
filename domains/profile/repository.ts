import { db } from '../../core/db/client';
import { students } from './model';
import { NewStudent, Student } from './types';
import { eq } from 'drizzle-orm';

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
    const updated = result[0];
    return { ...updated, avatar: updated.heroPortraitUri };
  }
}
