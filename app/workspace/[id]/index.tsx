import React from 'react';
import { View, StyleSheet, ScrollView, Text } from 'react-native';
import { PageContainer } from '../../../components/layout/PageContainer';
import { SectionHeader } from '../../../components/layout/SectionHeader';
import { StatCard } from '../../../components/cards/StatCard';
import { AppCard } from '../../../components/cards/AppCard';
import { TimelineCard } from '../../../components/cards/TimelineCard';
import { FacultyCard } from '../../../components/cards/FacultyCard';
import { colors, spacing, typography, radius } from '../../../tokens';
import { BookOpen, FlaskConical, GraduationCap, MapPin, Clock } from 'lucide-react-native';
import { useLocalSearchParams } from 'expo-router';
import { useWorkspace } from '../../../domains/workspace/hooks';
import { useAttendanceMetrics } from '../../../domains/attendance/hooks';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const ComponentTypeIcon = ({ type }: { type: string }) => {
  switch (type) {
    case 'lab': return <FlaskConical size={16} color={colors.light.accent} />;
    case 'tutorial': return <GraduationCap size={16} color={colors.light.warning} />;
    default: return <BookOpen size={16} color={colors.light.primary} />;
  }
};

const ComponentTypeColor = (type: string) => {
  switch (type) {
    case 'lab': return colors.light.accent;
    case 'tutorial': return colors.light.warning;
    default: return colors.light.primary;
  }
};

export default function WorkspaceOverview() {
  const { id } = useLocalSearchParams();
  const workspaceId = parseInt(id as string, 10);
  const { workspaceData, timeline, isLoading } = useWorkspace(workspaceId);
  const { metrics: overallMetrics } = useAttendanceMetrics(workspaceId);

  // Resolve from new getCompleteWorkspace shape
  const components = workspaceData?.components ?? [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PageContainer>
        <View style={styles.statsRow}>
          <StatCard 
            title="Target Attendance" 
            value={workspaceData?.targetAttendance ? `${workspaceData.targetAttendance}%` : "No Target"} 
            trend={overallMetrics?.hasData ? `Actual: ${overallMetrics.percentage}%` : "Actual: —"}
            trendDirection={overallMetrics?.hasData && overallMetrics.percentage !== null && overallMetrics.percentage >= (workspaceData?.targetAttendance || 0) ? "up" : "down"}
            icon={<BookOpen size={20} color={colors.light.primary} />}
            style={styles.flexHalf}
          />
        </View>

        {/* Components Section */}
        {components.length > 0 && (
          <>
            <SectionHeader title="Components" />
            {components.map((comp: any) => (
              <AppCard key={comp.id} style={styles.componentCard} padding="md">
                <View style={styles.componentHeader}>
                  <View style={[styles.componentBadge, { backgroundColor: ComponentTypeColor(comp.type) + '15' }]}>
                    <ComponentTypeIcon type={comp.type} />
                    <Text style={[styles.componentType, { color: ComponentTypeColor(comp.type) }]}>
                      {comp.type.charAt(0).toUpperCase() + comp.type.slice(1)}
                    </Text>
                  </View>
                  <Text style={styles.componentDuration}>{comp.durationMinutes} min</Text>
                </View>

                {/* Faculty */}
                {comp.activeFacultyName ? (
                  <View style={styles.componentDetail}>
                    <Text style={styles.detailLabel}>Faculty</Text>
                    <Text style={styles.detailValue}>{comp.activeFacultyName}</Text>
                  </View>
                ) : (
                  <View style={styles.componentDetail}>
                    <Text style={styles.detailLabel}>Faculty</Text>
                    <Text style={[styles.detailValue, { color: colors.light.textMuted }]}>Not assigned</Text>
                  </View>
                )}

                {/* Venue */}
                {comp.activeVenueName ? (
                  <View style={styles.componentDetail}>
                    <MapPin size={14} color={colors.light.textMuted} />
                    <Text style={styles.detailValue}>{comp.activeVenueName}</Text>
                  </View>
                ) : (
                  <View style={styles.componentDetail}>
                    <MapPin size={14} color={colors.light.textMuted} />
                    <Text style={[styles.detailValue, { color: colors.light.textMuted }]}>Not assigned</Text>
                  </View>
                )}

                {/* Schedule */}
                {comp.schedules && comp.schedules.length > 0 ? (
                  <View style={styles.scheduleRow}>
                    <Clock size={14} color={colors.light.textMuted} />
                    <View style={styles.scheduleColumn}>
                      {comp.schedules.map((s: any) => (
                        <Text key={s.id} style={styles.scheduleText}>
                          {`${DAY_NAMES[s.dayOfWeek]} ${s.startTime}–${s.endTime}`}
                        </Text>
                      ))}
                    </View>
                  </View>
                ) : (
                  <View style={styles.scheduleRow}>
                    <Clock size={14} color={colors.light.textMuted} />
                    <Text style={[styles.scheduleText, { color: colors.light.textMuted }]}>No sessions</Text>
                  </View>
                )}

                {/* Attendance */}
                {comp.attendanceMetrics && (
                  <View style={styles.attendanceDetail}>
                    <Text style={styles.attendanceValue}>
                      {comp.attendanceMetrics.hasData ? `${comp.attendanceMetrics.percentage}%` : '—'}
                    </Text>
                    <Text style={styles.attendanceLabel}>
                      {comp.attendanceMetrics.hasData 
                        ? `${comp.attendanceMetrics.present} Present · ${comp.attendanceMetrics.absent} Absent`
                        : 'Attendance'}
                    </Text>
                  </View>
                )}
              </AppCard>
            ))}
          </>
        )}

        <SectionHeader title="Subject Timeline" />
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
  componentCard: {
    marginBottom: spacing.sm,
  },
  componentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  componentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.md,
  },
  componentType: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  componentDuration: {
    fontSize: typography.fontSize.xs,
    color: colors.light.textMuted,
  },
  componentDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  detailLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.light.textMuted,
    width: 50,
  },
  detailValue: {
    fontSize: typography.fontSize.sm,
    color: colors.light.text,
    fontWeight: '500',
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 4,
  },
  scheduleColumn: {
    flex: 1,
    flexDirection: 'column',
  },
  scheduleText: {
    fontSize: typography.fontSize.xs,
    color: colors.light.textMuted,
    marginBottom: 2,
  },
  attendanceDetail: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.light.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  attendanceValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.light.text,
  },
  attendanceLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.light.textMuted,
  },
  emptyText: {
    color: colors.light.textMuted,
    fontSize: typography.fontSize.sm,
  }
});
