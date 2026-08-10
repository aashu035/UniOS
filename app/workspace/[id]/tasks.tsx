import React, { useCallback } from 'react';
import { View, StyleSheet, ScrollView, Alert, Text } from 'react-native';
import { PageContainer } from '../../../components/layout/PageContainer';
import { SectionHeader } from '../../../components/layout/SectionHeader';
import { AssignmentCard } from '../../../components/cards/AssignmentCard';
import { AppCard } from '../../../components/cards/AppCard';
import { colors, spacing, typography } from '../../../tokens';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useTasks } from '../../../domains/task/hooks';

export default function WorkspaceTasks() {
  const { id } = useLocalSearchParams();
  const workspaceId = parseInt(id as string, 10);
  const router = useRouter();
  const { tasks, refreshTasks, updateTaskStatus } = useTasks(workspaceId);

  useFocusEffect(useCallback(() => {
    refreshTasks();
  }, [refreshTasks]));

  const markComplete = (taskId: number) => {
    Alert.alert('Mark task as completed?', 'You can still view it in the completed list.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Mark complete', onPress: () => updateTaskStatus(taskId, 'submitted') },
    ]);
  };

  const pendingTasks = tasks.filter(t => t.status === 'pending');
  const completedTasks = tasks.filter(t => t.status !== 'pending');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PageContainer>
        <SectionHeader title="To Do" actionLabel="Add task" onActionPress={() => router.push({ pathname: '/task/add', params: { workspaceId: String(workspaceId) } })} />
        {pendingTasks.length > 0 ? (
          pendingTasks.map(task => (
            <AssignmentCard 
              key={task.id}
              title={task.title}
              dueDate={task.dueDate ?? 'No due date'}
              isCompleted={false}
              onPress={() => markComplete(task.id)}
            />
          ))
        ) : (
          <AppCard padding="md">
            <Text style={styles.emptyText}>No pending tasks. You're all caught up!</Text>
          </AppCard>
        )}
        <SectionHeader title="Completed" />
        {completedTasks.length > 0 ? (
          completedTasks.map(task => (
            <AssignmentCard 
              key={task.id}
              title={task.title}
              dueDate={task.dueDate ?? 'No submission date'}
              isCompleted={true}
              score={task.marksTotal ? `${task.marksObtained || 0}/${task.marksTotal}` : undefined}
            />
          ))
        ) : (
          <AppCard padding="md">
            <Text style={styles.emptyText}>No completed tasks yet.</Text>
          </AppCard>
        )}
      </PageContainer>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.light.background,
  },
  content: {
    paddingBottom: spacing.xxl,
  },
  emptyText: {
    color: colors.light.textMuted,
    fontSize: typography.fontSize.sm,
  }
});
