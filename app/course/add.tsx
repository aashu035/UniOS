import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { eq } from 'drizzle-orm';
import { ArrowLeft } from 'lucide-react-native';
import { colors, spacing, typography } from '../../tokens';
import { db } from '../../core/db/client';
import { faculty, venues, semesters, workspaces } from '../../core/db/schema';
import { ProfileRepository } from '../../domains/profile/repository';
import { CourseForm, CourseFormData } from '../../components/forms/CourseForm';

export default function AddCourse() {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (data: CourseFormData) => {
    setIsSaving(true);
    try {
      let facultyId: number | null = null;
      if (data.facultyName?.trim()) {
        const [createdFaculty] = await db.insert(faculty).values({ name: data.facultyName.trim() }).returning();
        facultyId = createdFaculty.id;
      }

      let venueId: number | null = null;
      if (data.venueName?.trim()) {
        const [createdVenue] = await db.insert(venues).values({ name: data.venueName.trim() }).returning();
        venueId = createdVenue.id;
      }

      const [activeSemester] = await db
        .select()
        .from(semesters)
        .where(eq(semesters.isActive, true))
        .limit(1);

      let semesterId = activeSemester?.id;
      if (!semesterId) {
        const profile = await ProfileRepository.getProfile();
        const [createdSemester] = await db.insert(semesters).values({
          number: profile?.currentSemester ?? 1,
          name: `Semester ${profile?.currentSemester ?? 1}`,
          isActive: true,
        }).returning();
        semesterId = createdSemester.id;
      }

      await db.insert(workspaces).values({
        semesterId,
        name: data.name.trim(),
        code: data.code?.trim() || null,
        facultyId,
        venueId,
        targetAttendance: data.targetAttendance ?? 75,
        type: 'theory',
      });

      router.back();
    } catch (error) {
      console.error('Could not add course', error);
      Alert.alert('Could not add course', 'Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconButton} accessibilityLabel="Go back">
          <ArrowLeft color={colors.light.text} size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add course</Text>
        <View style={styles.headerSpacer} />
      </View>

      <CourseForm
        onSubmit={handleSave}
        isSubmitting={isSaving}
        submitLabel="Save course"
        showFacultyVenue={true}
        showTargetAttendance={true}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.light.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.light.border,
  },
  iconButton: { padding: spacing.sm },
  headerTitle: { fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold, color: colors.light.text },
  headerSpacer: { width: 40 },
});
