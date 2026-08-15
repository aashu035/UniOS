import React, { useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { AppScaffold } from '../../components/layout/AppScaffold';
import { PageHeader } from '../../components/layout/PageHeader';
import { PageContainer } from '../../components/layout/PageContainer';
import { SubjectCard } from '../../components/cards/SubjectCard';
import { IconButton } from '../../components/buttons/IconButton';
import { EmptyState } from '../../components/layout/EmptyState';
import { BookOpen, Plus, Search } from 'lucide-react-native';
import { colors, spacing } from '../../tokens';
import { useFocusEffect, useRouter } from 'expo-router';
import { useWorkspaces } from '../../domains/workspace/hooks';

export default function Workspaces() {
  const router = useRouter();
  const { workspaces, refreshWorkspaces } = useWorkspaces();

  useFocusEffect(useCallback(() => {
    refreshWorkspaces();
  }, [refreshWorkspaces]));

  const activeWorkspaces = workspaces.map(ws => ({
    id: ws.id.toString(),
    title: ws.name,
    code: ws.code,
    attendance: ws.targetAttendance ?? 75
  }));

  return (
    <AppScaffold>
      <PageHeader 
        title="Workspaces" 
        rightAction={
          <View style={styles.headerActions}>
            <IconButton icon={<Search size={24} color={colors.light.text} />} onPress={() => router.push('/search')} />
            <IconButton icon={<Plus size={24} color={colors.light.text} />} onPress={() => router.push('/course/add')} accessibilityLabel="Add course" />
          </View>
        }
      />
      <PageContainer>
        {activeWorkspaces.length === 0 ? (
          <EmptyState
            icon={<BookOpen size={48} color={colors.light.textMuted} />}
            title="No courses yet"
            description="Add your first course to organize tasks, attendance, and resources."
            actionLabel="Add course"
            onAction={() => router.push('/course/add')}
          />
        ) : activeWorkspaces.map((ws) => (
          <SubjectCard
            key={ws.id}
            workspaceId={parseInt(ws.id, 10)}
            title={ws.title}
            code={ws.code}
            attendancePercentage={ws.attendance}
            onPress={() => router.push(`/workspace/${ws.id}`)}
          />
        ))}
      </PageContainer>
    </AppScaffold>
  );
}

const styles = StyleSheet.create({
  headerActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  }
});
