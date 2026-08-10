import React from 'react';
import { View, StyleSheet, ScrollView, Text } from 'react-native';
import { PageContainer } from '../../../components/layout/PageContainer';
import { SectionHeader } from '../../../components/layout/SectionHeader';
import { StatCard } from '../../../components/cards/StatCard';
import { AppCard } from '../../../components/cards/AppCard';
import { TimelineCard } from '../../../components/cards/TimelineCard';
import { FacultyCard } from '../../../components/cards/FacultyCard';
import { colors, spacing, typography } from '../../../tokens';
import { BookOpen, AlertTriangle } from 'lucide-react-native';
import { useLocalSearchParams } from 'expo-router';
import { useWorkspace } from '../../../domains/workspace/hooks';

export default function WorkspaceOverview() {
  const { id } = useLocalSearchParams();
  const workspaceId = parseInt(id as string, 10);
  const { workspaceData, timeline, isLoading } = useWorkspace(workspaceId);
  const facultyName = workspaceData?.faculty?.name ?? 'No instructor set';
  const facultyEmail = workspaceData?.faculty?.email ?? undefined;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PageContainer>
        <View style={styles.statsRow}>
          <StatCard 
            title="Attendance" 
            value={workspaceData?.targetAttendance ? `${workspaceData.targetAttendance}% Target` : "No Target"} 
            trend="Tracking disabled"
            trendDirection="down"
            icon={<BookOpen size={20} color={colors.light.primary} />}
            style={styles.flexHalf}
          />
          <StatCard 
            title="Alerts" 
            value="0" 
            trend="All caught up"
            trendDirection="up"
            icon={<AlertTriangle size={20} color={colors.light.warning} />}
            style={styles.flexHalf}
          />
        </View>

        <SectionHeader title="Faculty" />
        <FacultyCard 
          name={facultyName}
          title="Course Instructor"
          email={facultyEmail}
        />

        <SectionHeader title="Subject Timeline" actionLabel="View All" />
        {timeline.length > 0 ? (
          timeline.map((event) => (
            <TimelineCard 
              key={event.id}
              time={new Date(event.timestamp).toLocaleDateString()} 
              title={event.title} 
              subtitle={event.eventType} 
              venue={event.description}
              isActive={false}
            />
          ))
        ) : (
          <AppCard padding="md">
            <Text style={styles.emptyText}>No recent activity in this workspace.</Text>
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
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  flexHalf: {
    flex: 1,
  },
  emptyText: {
    color: colors.light.textMuted,
    fontSize: typography.fontSize.sm,
  }
});
