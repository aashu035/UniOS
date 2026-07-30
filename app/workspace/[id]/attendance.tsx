import React from 'react';
import { View, StyleSheet, ScrollView, Text } from 'react-native';
import { PageContainer } from '../../../components/layout/PageContainer';
import { SectionHeader } from '../../../components/layout/SectionHeader';
import { AppCard } from '../../../components/cards/AppCard';
import { AttendanceRing } from '../../../components/feedback/AttendanceRing';
import { TimelineCard } from '../../../components/cards/TimelineCard';
import { colors, spacing, typography, radius } from '../../../tokens';
import { useLocalSearchParams } from 'expo-router';
import { useAttendance } from '../../../domains/attendance/hooks';
export default function WorkspaceAttendance() {
  const { id } = useLocalSearchParams();
  const workspaceId = parseInt(id as string, 10);
  const { history, portalData, isLoading } = useAttendance(workspaceId);

  // If we have real portal data, use it. Otherwise fallback to mock stats.
  const attended = portalData?.portalPresent || 34;
  const total = portalData?.portalTotal || 40;
  const missed = total - attended;
  const percentage = portalData?.portalPercent || 85;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PageContainer>
        <AppCard style={styles.heroCard}>
          <AttendanceRing percentage={percentage} size={120} strokeWidth={12} />
          <View style={styles.heroText}>
            <Text style={styles.heroTitle}>On Track</Text>
            <Text style={styles.heroSubtitle}>You can safely miss 3 more classes.</Text>
          </View>
        </AppCard>

        <View style={styles.statsRow}>
          <AppCard style={styles.statBox} padding="md">
            <Text style={styles.statValue}>{attended}</Text>
            <Text style={styles.statLabel}>Attended</Text>
          </AppCard>
          <AppCard style={styles.statBox} padding="md">
            <Text style={styles.statValue}>{missed}</Text>
            <Text style={styles.statLabel}>Missed</Text>
          </AppCard>
          <AppCard style={styles.statBox} padding="md">
            <Text style={styles.statValue}>{total}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </AppCard>
        </View>

        <SectionHeader title="Recent History" actionLabel="Full Log" />
        {history.length > 0 ? (
          history.map(record => (
            <TimelineCard 
              key={record.id}
              time={record.date} 
              title={record.status.charAt(0).toUpperCase() + record.status.slice(1)} 
              subtitle="Lecture" 
              venue={record.notes || ''}
              isActive={record.status === 'present'}
            />
          ))
        ) : (
          <>
            <TimelineCard 
              time="Mon, 10th" 
              title="Present" 
              subtitle="Lecture" 
              venue="Prof. Sharma"
              isActive={true}
            />
        <TimelineCard 
          time="Fri, 7th" 
          title="Absent" 
          subtitle="Lecture" 
          venue="Prof. Sharma"
          isActive={false}
        />
            <TimelineCard 
              time="Wed, 5th" 
              title="Present" 
              subtitle="Lecture" 
              venue="Prof. Sharma"
              isActive={true}
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
  },
  heroCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    marginBottom: spacing.md,
  },
  heroText: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  heroTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.light.text,
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.light.textMuted,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.light.text,
  },
  statLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.light.textMuted,
    marginTop: 4,
  }
});
