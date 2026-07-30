import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { AppScaffold } from '../../components/layout/AppScaffold';
import { PageHeader } from '../../components/layout/PageHeader';
import { PageContainer } from '../../components/layout/PageContainer';
import { SubjectCard } from '../../components/cards/SubjectCard';
import { IconButton } from '../../components/buttons/IconButton';
import { Plus, Search } from 'lucide-react-native';
import { colors, spacing } from '../../tokens';
import { useRouter } from 'expo-router';
import { useWorkspaces } from '../../domains/workspace/hooks';

export default function Workspaces() {
  const router = useRouter();
  const { workspaces, isLoading } = useWorkspaces();
  
  // Mock Data fallback
  const mockWorkspaces = [
    { id: '1', title: 'Data Structures & Algorithms', code: 'CSE-301', attendance: 85 },
    { id: '2', title: 'Operating Systems', code: 'CSE-302', attendance: 92 },
    { id: '3', title: 'Database Management Systems', code: 'CSE-303', attendance: 65 },
    { id: '4', title: 'Software Engineering', code: 'CSE-304', attendance: 100 },
  ];

  const activeWorkspaces = workspaces.length > 0 ? workspaces.map(ws => ({
    id: ws.id.toString(),
    title: ws.name,
    code: ws.code,
    attendance: ws.targetAttendance || 75
  })) : mockWorkspaces;

  return (
    <AppScaffold>
      <PageHeader 
        title="Workspaces" 
        rightAction={
          <View style={styles.headerActions}>
            <IconButton icon={<Search size={24} color={colors.light.text} />} onPress={() => router.push('/search')} />
            <IconButton icon={<Plus size={24} color={colors.light.text} />} />
          </View>
        }
      />
      <PageContainer>
        {activeWorkspaces.map((ws) => (
          <SubjectCard
            key={ws.id}
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
