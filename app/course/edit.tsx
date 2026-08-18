import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { WorkspaceRepository } from '../../domains/workspace/repository';
import { useWorkspace } from '../../domains/workspace/hooks';
import { colors, radius, spacing, typography } from '../../tokens';
import { CourseForm, CourseFormData } from '../../components/forms/CourseForm';
import { Skeleton } from '../../components/ui/Skeleton';

export default function EditCourse() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const workspaceId = Number(id);
  const { workspaceData, isLoading } = useWorkspace(Number.isFinite(workspaceId) ? workspaceId : 0);
  const [isSaving, setIsSaving] = useState(false);

  const save = async (data: CourseFormData) => {
    setIsSaving(true);
    try {
      await WorkspaceRepository.updateCourseIdentity(workspaceId, {
        name: data.name,
        code: data.code,
        targetAttendance: data.targetAttendance,
        credits: data.credits,
      });

      const primaryComp = workspaceData?.components?.[0];
      if (primaryComp?.id) {
        if (data.facultyName && data.facultyName !== primaryComp.activeFacultyName) {
          await WorkspaceRepository.changeHistoricalFaculty(
            primaryComp.id,
            data.facultyName,
            new Date().toISOString().split('T')[0]
          );
        }
        if (data.venueName && data.venueName !== primaryComp.activeVenueName) {
          await WorkspaceRepository.changeHistoricalVenue(
            primaryComp.id,
            data.venueName,
            new Date().toISOString().split('T')[0]
          );
        }
      }

      router.back();
    } catch (error: any) {
      console.error('Could not update course', error);
      Alert.alert('Could not save course', 'Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <SafeAreaView style={styles.safeArea}><View style={styles.loader}><Skeleton height={400} borderRadius={16} /></View></SafeAreaView>;
  if (!workspaceData) return <SafeAreaView style={styles.safeArea}><View style={styles.loader}><Text style={styles.notFound}>Course not found.</Text></View></SafeAreaView>;

  const workspace = workspaceData.workspace;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.back()} accessibilityLabel="Go back">
          <ArrowLeft size={24} color={colors.light.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit course</Text>
        <View style={styles.headerSpacer} />
      </View>

      <CourseForm
        initialValues={{
          name: workspace.name ?? '',
          code: workspace.code ?? '',
          targetAttendance: workspace.targetAttendance ?? 75,
          facultyName: workspaceData.faculty?.name ?? '',
          venueName: workspaceData.venue?.name ?? '',
          credits: workspace.credits ?? 3,
          type: (workspaceData.components?.[0]?.type as any) ?? 'theory',
          notes: workspace.notes ?? '',
        }}
        onSubmit={save}
        isSubmitting={isSaving}
        submitLabel="Save changes"
        showFacultyVenue={true}
        showTargetAttendance={true}
      />

      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.deleteButton} 
          onPress={() => {
            Alert.alert(
              "Delete Workspace",
              "Are you sure you want to delete this workspace? This will permanently remove its Tasks, Materials, Timeline events, Calendar schedule, and Attendance history. This action cannot be undone.",
              [
                { text: "Cancel", style: "cancel" },
                { 
                  text: "Delete", 
                  style: "destructive",
                  onPress: async () => {
                    try {
                      setIsSaving(true);
                      await WorkspaceRepository.deleteWorkspace(workspaceId);
                      // Make sure to replace rather than push so we can't go back to the deleted workspace
                      router.replace('/(main)/home');
                    } catch (error) {
                      console.error('Could not delete workspace', error);
                      Alert.alert('Error', 'Failed to delete workspace.');
                    } finally {
                      setIsSaving(false);
                    }
                  }
                }
              ]
            );
          }}
          disabled={isSaving}
        >
          <Text style={styles.deleteText}>Delete Workspace</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.light.background },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFound: { color: colors.light.textMuted, fontSize: typography.fontSize.base },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.light.border },
  iconButton: { padding: spacing.sm },
  headerSpacer: { width: 40 },
  headerTitle: { color: colors.light.text, fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold },
  footer: { padding: spacing.xl, paddingBottom: spacing.xxl },
  deleteButton: { minHeight: 52, borderRadius: radius.xl, backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.light.danger, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  deleteText: { color: colors.light.danger, fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.bold },
});

