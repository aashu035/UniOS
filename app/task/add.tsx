import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Save } from 'lucide-react-native';
import { TaskRepository } from '../../domains/task/repository';
import { useWorkspaces } from '../../domains/workspace/hooks';
import { colors, radius, spacing, typography } from '../../tokens';

const PRIORITIES = ['low', 'medium', 'high'] as const;

export default function AddTask() {
  const router = useRouter();
  const { workspaceId } = useLocalSearchParams<{ workspaceId?: string }>();
  const { workspaces, isLoading } = useWorkspaces();
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<typeof PRIORITIES[number]>('medium');
  const parsedWorkspaceId = workspaceId ? parseInt(workspaceId as string, 10) : null;
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const isRouteWorkspaceInvalid = workspaceId && (
    isNaN(parsedWorkspaceId!) || 
    (!isLoading && !workspaces.some(w => w.id === parsedWorkspaceId))
  );

  useEffect(() => {
    if (selectedWorkspaceId === null && workspaces[0] && !workspaceId) {
      setSelectedWorkspaceId(workspaces[0].id);
    }
  }, [selectedWorkspaceId, workspaces, workspaceId]);

  const save = async () => {
    if (!title.trim()) {
      Alert.alert('Task name required', 'Give this task a short, clear name.');
      return;
    }
    if (isRouteWorkspaceInvalid) {
      Alert.alert('Invalid Course', 'The selected course does not exist.');
      return;
    }
    if (!selectedWorkspaceId && !parsedWorkspaceId) {
      Alert.alert('Choose a course', 'Create a course first, then add a task to it.');
      return;
    }
    
    const finalWorkspaceId = parsedWorkspaceId || selectedWorkspaceId!;
    setIsSaving(true);
    
    try {
      await TaskRepository.createTask({ 
        workspaceId: finalWorkspaceId, 
        title: title.trim(), 
        dueDate: dueDate.trim() || undefined, 
        priority, 
        status: 'pending' 
      });
      router.back();
    } catch (error: any) {
      console.error('Could not create task', error);
      Alert.alert('Could not save task', error.message || 'Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}><TouchableOpacity style={styles.iconButton} onPress={() => router.back()} accessibilityLabel="Go back"><ArrowLeft size={24} color={colors.light.text} /></TouchableOpacity><Text style={styles.headerTitle}>Add task</Text><View style={styles.headerSpacer} /></View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Task name *</Text>
        <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="e.g. Finish assignment 3" placeholderTextColor={colors.light.textMuted} autoFocus />
        <Text style={styles.label}>Due date or reminder</Text>
        <TextInput style={styles.input} value={dueDate} onChangeText={setDueDate} placeholder="e.g. Friday, 5:00 PM" placeholderTextColor={colors.light.textMuted} />
        <Text style={styles.label}>Course</Text>
        {isRouteWorkspaceInvalid ? (
          <Text style={styles.errorText}>Error: The course for this task could not be found.</Text>
        ) : workspaceId ? (
          <View style={styles.chips}>
            {workspaces.filter(w => w.id === Number(workspaceId)).map(workspace => (
              <View key={workspace.id} style={[styles.courseChip, styles.courseChipActive]}>
                <Text style={styles.courseChipTextActive}>{workspace.code || workspace.name}</Text>
              </View>
            ))}
          </View>
        ) : isLoading ? (
          <Text style={styles.muted}>Loading courses…</Text>
        ) : workspaces.length === 0 ? (
          <Text style={styles.muted}>No courses yet. Add a course from Workspaces first.</Text>
        ) : (
          <View style={styles.chips}>
            {workspaces.map(workspace => (
              <TouchableOpacity key={workspace.id} onPress={() => setSelectedWorkspaceId(workspace.id)} style={[styles.courseChip, selectedWorkspaceId === workspace.id && styles.courseChipActive]}>
                <Text style={[styles.courseChipText, selectedWorkspaceId === workspace.id && styles.courseChipTextActive]}>{workspace.code || workspace.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        <Text style={styles.label}>Priority</Text>
        <View style={styles.chips}>{PRIORITIES.map(item => <TouchableOpacity key={item} onPress={() => setPriority(item)} style={[styles.priorityChip, priority === item && styles.priorityChipActive]}><Text style={[styles.priorityText, priority === item && styles.priorityTextActive]}>{item[0].toUpperCase() + item.slice(1)}</Text></TouchableOpacity>)}</View>
      </ScrollView>
      <View style={styles.footer}><TouchableOpacity style={[styles.saveButton, (isSaving || !title.trim()) && styles.disabled]} onPress={save} disabled={isSaving || !title.trim()}><Save size={20} color={colors.dark.text} style={styles.saveIcon} /><Text style={styles.saveText}>{isSaving ? 'Saving…' : 'Save task'}</Text></TouchableOpacity></View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.light.background }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.light.border }, iconButton: { padding: spacing.sm }, headerTitle: { color: colors.light.text, fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold }, headerSpacer: { width: 40 }, content: { padding: spacing.xl }, label: { color: colors.light.text, fontWeight: typography.fontWeight.semibold, fontSize: typography.fontSize.sm, marginTop: spacing.lg, marginBottom: spacing.sm }, input: { minHeight: 52, backgroundColor: colors.light.surface, borderColor: colors.light.border, borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: spacing.lg, color: colors.light.text, fontSize: typography.fontSize.base }, muted: { color: colors.light.textMuted, fontSize: typography.fontSize.sm }, errorText: { color: colors.light.danger || 'red', fontSize: typography.fontSize.sm, marginTop: spacing.sm }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, courseChip: { borderRadius: radius.full, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.light.border, backgroundColor: colors.light.surface }, courseChipActive: { backgroundColor: colors.light.primary, borderColor: colors.light.primary }, courseChipText: { color: colors.light.text, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium }, courseChipTextActive: { color: colors.dark.text }, priorityChip: { borderRadius: radius.full, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.light.border }, priorityChipActive: { backgroundColor: colors.light.primary, borderColor: colors.light.primary }, priorityText: { color: colors.light.text, fontSize: typography.fontSize.sm }, priorityTextActive: { color: colors.dark.text }, footer: { padding: spacing.xl, borderTopWidth: 1, borderTopColor: colors.light.border }, saveButton: { minHeight: 52, backgroundColor: colors.light.primary, borderRadius: radius.xl, justifyContent: 'center', alignItems: 'center', flexDirection: 'row' }, saveIcon: { marginRight: spacing.sm }, saveText: { color: colors.dark.text, fontWeight: typography.fontWeight.bold, fontSize: typography.fontSize.base }, disabled: { opacity: 0.5 },
});
