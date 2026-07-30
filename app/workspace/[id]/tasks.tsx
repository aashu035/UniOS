import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { PageContainer } from '../../../components/layout/PageContainer';
import { SectionHeader } from '../../../components/layout/SectionHeader';
import { AssignmentCard } from '../../../components/cards/AssignmentCard';
import { colors, spacing } from '../../../tokens';
import { useLocalSearchParams } from 'expo-router';
import { useTasks } from '../../../domains/task/hooks';

export default function WorkspaceTasks() {
  const { id } = useLocalSearchParams();
  const workspaceId = parseInt(id as string, 10);
  const { tasks, isLoading } = useTasks(workspaceId);

  const pendingTasks = tasks.filter(t => t.status === 'pending');
  const completedTasks = tasks.filter(t => t.status !== 'pending');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PageContainer>
        <SectionHeader title="To Do" />
        {pendingTasks.length > 0 ? (
          pendingTasks.map(task => (
            <AssignmentCard 
              key={task.id}
              title={task.title}
              dueDate={task.dueDate ? `Due ${task.dueDate}` : undefined}
              isCompleted={false}
            />
          ))
        ) : (
          <>
            <AssignmentCard 
              title="Programming Assignment 3"
              dueDate="Tomorrow, 11:59 PM"
              isCompleted={false}
            />
            <AssignmentCard 
              title="Midterm Preparation Quiz"
              dueDate="Friday, 5:00 PM"
              isCompleted={false}
            />
          </>
        )}
        <SectionHeader title="Completed" />
        {completedTasks.length > 0 ? (
          completedTasks.map(task => (
            <AssignmentCard 
              key={task.id}
              title={task.title}
              dueDate={task.dueDate ? `Submitted ${task.dueDate}` : undefined}
              isCompleted={true}
              score={task.marksTotal ? `${task.marksObtained || 0}/${task.marksTotal}` : undefined}
            />
          ))
        ) : (
          <>
            <AssignmentCard 
              title="Programming Assignment 2"
              dueDate="Last Week"
              isCompleted={true}
              score="18/20"
            />
            <AssignmentCard 
              title="Programming Assignment 1"
              dueDate="2 Weeks Ago"
              isCompleted={true}
              score="20/20"
            />
          </>
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
  }
});
