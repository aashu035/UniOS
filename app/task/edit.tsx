import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Save, Trash2 } from 'lucide-react-native';
import { TaskRepository } from '../../domains/task/repository';
import { colors, radius, spacing, typography } from '../../tokens';

const PRIORITIES = ['low', 'medium', 'high'] as const;

export default function EditTask() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const taskId = Number(id);

  const [isLoading, setIsLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<typeof PRIORITIES[number]>('medium');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function loadTask() {
      try {
        const task = await TaskRepository.getTaskById(taskId);
        if (task) {
          setTitle(task.title);
          setDueDate(task.dueDate || '');
          setPriority(task.priority as any || 'medium');
        } else {
          Alert.alert('Error', 'Task not found.');
          router.back();
        }
      } catch (err) {
        console.error(err);
        Alert.alert('Error', 'Failed to load task.');
      } finally {
        setIsLoading(false);
      }
    }
    loadTask();
  }, [taskId]);

  const save = async () => {
    if (!title.trim()) {
      Alert.alert('Task name required', 'Give this task a short, clear name.');
      return;
    }
    
    setIsSaving(true);
    try {
      await TaskRepository.updateTask(taskId, { 
        title: title.trim(), 
        dueDate: dueDate.trim() || undefined, 
        priority 
      });
      router.back();
    } catch (error: any) {
      console.error('Could not update task', error);
      Alert.alert('Could not save task', error.message || 'Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      "Delete Task",
      "Are you sure you want to delete this task? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete Task", 
          style: "destructive",
          onPress: async () => {
            try {
              setIsSaving(true);
              await TaskRepository.deleteTask(taskId);
              router.back();
            } catch (error) {
              console.error('Could not delete task', error);
              Alert.alert('Error', 'Failed to delete task.');
            } finally {
              setIsSaving(false);
            }
          }
        }
      ]
    );
  };

  if (isLoading) {
    return <SafeAreaView style={styles.safeArea}><Text style={{padding: spacing.xl, color: colors.light.text}}>Loading...</Text></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.back()} accessibilityLabel="Go back">
          <ArrowLeft size={24} color={colors.light.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit task</Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Task name *</Text>
        <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="e.g. Finish assignment 3" placeholderTextColor={colors.light.textMuted} autoFocus />
        
        <Text style={styles.label}>Due date or reminder</Text>
        <TextInput style={styles.input} value={dueDate} onChangeText={setDueDate} placeholder="e.g. Friday, 5:00 PM" placeholderTextColor={colors.light.textMuted} />
        
        <Text style={styles.label}>Priority</Text>
        <View style={styles.chips}>
          {PRIORITIES.map(item => (
            <TouchableOpacity key={item} onPress={() => setPriority(item)} style={[styles.priorityChip, priority === item && styles.priorityChipActive]}>
              <Text style={[styles.priorityText, priority === item && styles.priorityTextActive]}>
                {item[0].toUpperCase() + item.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete} disabled={isSaving}>
          <Trash2 size={20} color={colors.light.danger} style={{marginRight: spacing.sm}} />
          <Text style={styles.deleteText}>Delete Task</Text>
        </TouchableOpacity>

      </ScrollView>
      <View style={styles.footer}>
        <TouchableOpacity style={[styles.saveButton, (isSaving || !title.trim()) && styles.disabled]} onPress={save} disabled={isSaving || !title.trim()}>
          <Save size={20} color={colors.dark.text} style={styles.saveIcon} />
          <Text style={styles.saveText}>{isSaving ? 'Saving…' : 'Save changes'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.light.background }, 
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.light.border }, 
  iconButton: { padding: spacing.sm }, 
  headerTitle: { color: colors.light.text, fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold }, 
  headerSpacer: { width: 40 }, 
  content: { padding: spacing.xl }, 
  label: { color: colors.light.text, fontWeight: typography.fontWeight.semibold, fontSize: typography.fontSize.sm, marginTop: spacing.lg, marginBottom: spacing.sm }, 
  input: { minHeight: 52, backgroundColor: colors.light.surface, borderColor: colors.light.border, borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: spacing.lg, color: colors.light.text, fontSize: typography.fontSize.base }, 
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, 
  priorityChip: { borderRadius: radius.full, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.light.border }, 
  priorityChipActive: { backgroundColor: colors.light.primary, borderColor: colors.light.primary }, 
  priorityText: { color: colors.light.text, fontSize: typography.fontSize.sm }, 
  priorityTextActive: { color: colors.dark.text }, 
  deleteButton: { marginTop: spacing.xxl, minHeight: 52, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.light.danger, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  deleteText: { color: colors.light.danger, fontWeight: typography.fontWeight.bold, fontSize: typography.fontSize.base },
  footer: { padding: spacing.xl, borderTopWidth: 1, borderTopColor: colors.light.border }, 
  saveButton: { minHeight: 52, backgroundColor: colors.light.primary, borderRadius: radius.xl, justifyContent: 'center', alignItems: 'center', flexDirection: 'row' }, 
  saveIcon: { marginRight: spacing.sm }, 
  saveText: { color: colors.dark.text, fontWeight: typography.fontWeight.bold, fontSize: typography.fontSize.base }, 
  disabled: { opacity: 0.5 },
});
