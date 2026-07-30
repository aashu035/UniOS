import React from 'react';
import { View, StyleSheet, Text, ActivityIndicator } from 'react-native';
import { AppScaffold } from '../../components/layout/AppScaffold';
import { PageContainer } from '../../components/layout/PageContainer';
import { HeroBanner } from '../../components/layout/HeroBanner';
import { SectionHeader } from '../../components/layout/SectionHeader';
import { TimelineCard } from '../../components/cards/TimelineCard';
import { SubjectCard } from '../../components/cards/SubjectCard';
import { AppCard } from '../../components/cards/AppCard';
import { StatusBadge } from '../../components/feedback/StatusBadge';
import { IconButton } from '../../components/buttons/IconButton';
import { useProfile } from '../../domains/profile/hooks';
import { Bell, Calendar, FileText, Download } from 'lucide-react-native';
import { colors, spacing, typography } from '../../tokens';
import { useRouter } from 'expo-router';
import { useTasks } from '../../domains/task/hooks';
import { useWorkspaces } from '../../domains/workspace/hooks';

export default function Home() {
  const { profile, isLoading: profileLoading } = useProfile();
  const { tasks, isLoading: tasksLoading } = useTasks();
  const { workspaces, isLoading: workspacesLoading } = useWorkspaces();
  const router = useRouter();

  if (profileLoading || tasksLoading || workspacesLoading) {
    return (
      <AppScaffold>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.light.primary} />
        </View>
      </AppScaffold>
    );
  }

  // Fallback data if profile isn't fully loaded
  const name = profile?.name || 'Student';
  const semester = profile?.currentSemester ? `Semester ${profile.currentSemester}` : 'Semester';

  // Mock Data for Phase 2 UI Showcase
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const subtitle = `${semester} • ${today}`;

  return (
    <AppScaffold>
      <PageContainer>
        {/* Hero Section */}
        <HeroBanner 
          greeting="Good Morning,"
          title={name}
          subtitle={subtitle}
          accent="primary"
          showPortrait={true}
          rightElement={
            <IconButton 
              icon={<Bell size={24} color={colors.dark.text} />} 
              variant="ghost" 
              onPress={() => router.push('/notifications')}
            />
          }
        >
          <View style={styles.heroStatsRow}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>3</Text>
              <Text style={styles.heroStatLabel}>Classes Today</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{tasks.length > 0 ? tasks.length : 2}</Text>
              <Text style={styles.heroStatLabel}>Tasks Due</Text>
            </View>
          </View>
        </HeroBanner>

        {/* What should I do today? -> Next Lecture */}
        <SectionHeader 
          title="Next Lecture" 
          action={<IconButton icon={<Calendar size={20} color={colors.light.primary} />} />}
        />
        <TimelineCard 
          time="10:00 AM" 
          title="Data Structures & Algorithms" 
          subtitle="Prof. Sharma" 
          venue="Room 304, Block B"
          isActive={true}
        />
        <TimelineCard 
          time="11:30 AM" 
          title="Operating Systems" 
          subtitle="Prof. Gupta" 
          venue="Lab 2, Block A"
        />

        {/* Today's Focus */}
        <SectionHeader 
          title="Today's Focus" 
        />
        {tasks.length > 0 ? (
          <AppCard padding="md" style={styles.focusCard}>
            <View style={styles.focusIcon}>
              <FileText size={24} color={colors.light.primary} />
            </View>
            <View style={styles.focusContent}>
              <Text style={styles.focusTitle}>{tasks[0].title}</Text>
              <Text style={styles.focusSubtitle}>{tasks[0].dueDate ? `Due ${tasks[0].dueDate}` : 'Due Soon'}</Text>
            </View>
            <StatusBadge label={tasks[0].priority === 'high' ? 'Urgent' : 'To Do'} variant={tasks[0].priority === 'high' ? 'error' : 'warning'} />
          </AppCard>
        ) : (
          <AppCard padding="md" style={styles.focusCard}>
            <View style={styles.focusIcon}>
              <FileText size={24} color={colors.light.primary} />
            </View>
            <View style={styles.focusContent}>
              <Text style={styles.focusTitle}>OS Assignment 2</Text>
              <Text style={styles.focusSubtitle}>Due Tonight at 11:59 PM</Text>
            </View>
            <StatusBadge label="Urgent" variant="error" />
          </AppCard>
        )}

        {/* Attendance Alerts */}
        <SectionHeader 
          title="Attendance Alerts" 
        />
        {workspaces.length > 0 ? (
          workspaces.slice(0, 1).map((ws) => (
            <SubjectCard 
              key={ws.id}
              title={ws.name} 
              code={ws.code || 'SUBJ'} 
              attendancePercentage={ws.targetAttendance || 75} 
              onPress={() => router.push(`/workspace/${ws.id}`)}
            />
          ))
        ) : (
          <SubjectCard 
            title="Data Structures & Algorithms" 
            code="CSE-301" 
            attendancePercentage={85} 
            onPress={() => router.push('/workspace/1')}
          />
        )}

        {/* Recent Uploads */}
        <SectionHeader 
          title="Recent Uploads" 
        />
        <AppCard padding="md" variant="outlined" style={styles.uploadCard}>
          <View style={styles.uploadInfo}>
            <Text style={styles.uploadTitle}>DSA Notes - Trees</Text>
            <Text style={styles.uploadSubtitle}>Uploaded by Rahul • 2 hours ago</Text>
          </View>
          <IconButton icon={<Download size={20} color={colors.light.primary} />} variant="filled" />
        </AppCard>

      </PageContainer>
    </AppScaffold>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 16,
    padding: spacing.md,
  },
  heroStat: {
    flex: 1,
    alignItems: 'center',
  },
  heroStatDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  heroStatValue: {
    color: colors.dark.text,
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
  },
  heroStatLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: typography.fontSize.xs,
    marginTop: 2,
  },
  focusCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  focusIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: `${colors.light.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  focusContent: {
    flex: 1,
  },
  focusTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.light.text,
  },
  focusSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.light.textMuted,
    marginTop: 2,
  },
  uploadCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  uploadInfo: {
    flex: 1,
  },
  uploadTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.light.text,
  },
  uploadSubtitle: {
    fontSize: typography.fontSize.xs,
    color: colors.light.textMuted,
    marginTop: 2,
  }
});
