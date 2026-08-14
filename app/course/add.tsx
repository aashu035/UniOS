import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { eq } from 'drizzle-orm';
import { ArrowLeft } from 'lucide-react-native';
import { colors, spacing, typography } from '../../tokens';
import { WorkspaceRepository } from '../../domains/workspace/repository';
import { CourseForm, CourseFormData } from '../../components/forms/CourseForm';

export default function AddCourse() {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (data: CourseFormData) => {
    setIsSaving(true);
    try {
      await WorkspaceRepository.createWorkspace({
        name: data.name,
        code: data.code,
        facultyName: data.facultyName,
        venueName: data.venueName,
        targetAttendance: data.targetAttendance,
        credits: data.credits,
        type: data.type,
        notes: data.notes,
      });

      router.back();
    } catch (error: any) {
      console.error('Could not add course', error);
      Alert.alert('Could not add course', error.message || 'Please try again.');
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
