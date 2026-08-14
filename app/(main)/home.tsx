import React from 'react';
import { View, StyleSheet, Text, ActivityIndicator, Pressable } from 'react-native';
import { AppScaffold } from '../../components/layout/AppScaffold';
import { PageContainer } from '../../components/layout/PageContainer';
import { HeroBanner } from '../../components/layout/HeroBanner';
import { SectionHeader } from '../../components/layout/SectionHeader';
import { TimelineCard } from '../../components/cards/TimelineCard';
import { SubjectCard } from '../../components/cards/SubjectCard';
import { AppCard } from '../../components/cards/AppCard';
import { StatusBadge } from '../../components/feedback/StatusBadge';
import { IconButton } from '../../components/buttons/IconButton';
import { Skeleton } from '../../components/ui/Skeleton';
import { useProfile } from '../../domains/profile/hooks';
import { Bell, Calendar, FileText, Download } from 'lucide-react-native';
import { colors, spacing, typography, radius } from '../../tokens';
import { useRouter } from 'expo-router';
import { useTasks } from '../../domains/task/hooks';
import { useWorkspaces } from '../../domains/workspace/hooks';
import { useCalendar, useHeroCardContext } from '../../domains/calendar/hooks';
import { useRecentResources } from '../../domains/resource/hooks';

export default function Home() {
  const { profile, isLoading: profileLoading } = useProfile();
  const { tasks, isLoading: tasksLoading } = useTasks();
  const { workspaces, isLoading: workspacesLoading } = useWorkspaces();
  const todayDayOfWeek = new Date().getDay();
  const { events, isLoading: eventsLoading } = useCalendar(todayDayOfWeek);
  const { resources, isLoading: resourcesLoading } = useRecentResources(3);
  const router = useRouter();

  const name = profile?.name || 'Student';
  const { greeting, subtitle, nextEvent, currentEvent } = useHeroCardContext(events, name);

  if (profileLoading || tasksLoading || workspacesLoading || eventsLoading || resourcesLoading) {
    return (
      <AppScaffold>
        <PageContainer>
          <Skeleton height={200} borderRadius={radius.xl} style={{ marginBottom: spacing.xl }} />
          <Skeleton height={32} width={150} style={{ marginBottom: spacing.md }} />
          <Skeleton height={100} borderRadius={radius.lg} style={{ marginBottom: spacing.sm }} />
          <Skeleton height={100} borderRadius={radius.lg} style={{ marginBottom: spacing.xl }} />
          <Skeleton height={32} width={150} style={{ marginBottom: spacing.md }} />
          <Skeleton height={80} borderRadius={radius.lg} />
        </PageContainer>
      </AppScaffold>
    );
  }

  return (
    <AppScaffold>
      <PageContainer>
        {/* Dynamic Hero Section */}
        <HeroBanner 
          greeting={greeting}
          title={name}
          subtitle={subtitle}
          accent="primary"
          showPortrait={true}
          imageUrl={profile?.avatar || undefined}
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
              <Text style={styles.heroStatValue}>{events.length}</Text>
              <Text style={styles.heroStatLabel}>Classes Today</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{tasks.length}</Text>
              <Text style={styles.heroStatLabel}>Tasks Due</Text>
            </View>
          </View>
        </HeroBanner>

        {/* Today's Schedule (Vertical Stack) */}
        <SectionHeader 
          title="Today's Schedule" 
          action={<IconButton icon={<Calendar size={20} color={colors.light.primary} />} onPress={() => router.push('/(main)/planner')} accessibilityLabel="Open planner" />}
        />
        {events.length > 0 ? (
          <View style={styles.verticalStack}>
            {events.map((event, index) => (
              <TimelineCard 
                key={event.id}
                time={`${event.startTime} - ${event.endTime}`} 
                title={event.title || event.workspaceName || 'Event'} 
                subtitle={event.description || (event.type === 'work' ? 'External Work' : 'Lecture')} 
                venue={event.location || event.venueName || 'TBD'}
                isActive={currentEvent?.id === event.id || nextEvent?.id === event.id}
                onPress={event.workspaceId ? () => router.push(`/workspace/${event.workspaceId}`) : undefined}
              />
            ))}
          </View>
        ) : (
          <AppCard padding="md">
            <Text style={{color: colors.light.text, fontWeight: '500'}}>No classes scheduled for today.</Text>
            <Text style={{color: colors.light.textMuted, fontSize: typography.fontSize.sm, marginTop: 4}}>Enjoy your day off! Why not get ahead on readings?</Text>
          </AppCard>
        )}

        {/* Today's Focus */}
        <SectionHeader title="Today's Focus" />
        {tasks.length > 0 ? (
          <View style={styles.verticalStack}>
            {tasks.map(task => (
              <AppCard key={task.id} padding="md" style={styles.focusCard}>
                <View style={styles.focusIcon}>
                  <FileText size={24} color={colors.light.primary} />
                </View>
                <View style={styles.focusContent}>
                  <Text style={styles.focusTitle}>{task.title}</Text>
                  <Text style={styles.focusSubtitle}>{task.dueDate ? `Due ${task.dueDate}` : 'Due Soon'}</Text>
                </View>
                <StatusBadge label={task.priority === 'high' ? 'Urgent' : 'To Do'} variant={task.priority === 'high' ? 'error' : 'warning'} />
              </AppCard>
            ))}
          </View>
        ) : (
          <AppCard padding="md">
            <Text style={{color: colors.light.text, fontWeight: '500'}}>You are all caught up!</Text>
            <Text style={{color: colors.light.textMuted, fontSize: typography.fontSize.sm, marginTop: 4}}>All clear for now. Great job staying on top of things.</Text>
          </AppCard>
        )}

        {/* Attendance Targets */}
        <SectionHeader title="Attendance Targets" />
        {workspaces.length > 0 ? (
          <View style={styles.verticalStack}>
            {workspaces.slice(0, 2).map((ws) => (
              <SubjectCard 
                key={ws.id}
                title={ws.name} 
                code={ws.code || 'SUBJ'} 
                attendancePercentage={ws.targetAttendance || 75} 
                onPress={() => router.push(`/workspace/${ws.id}`)}
              />
            ))}
          </View>
        ) : (
          <AppCard padding="md">
            <Text style={{color: colors.light.textMuted}}>Enroll in a workspace to track attendance.</Text>
          </AppCard>
        )}

        {/* Recent Uploads / Notes - Now Clickable */}
        <SectionHeader title="Recent Uploads / Notes" />
        {resources.length > 0 ? (
          <View style={styles.verticalStack}>
            {resources.map((res) => (
              <Pressable 
                key={res.id} 
                onPress={() => res.workspaceId ? router.push(`/workspace/${res.workspaceId}`) : null}
                style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
              >
                <AppCard padding="md" variant="outlined" style={styles.uploadCard}>
                  <View style={styles.uploadInfo}>
                    <Text style={styles.uploadTitle}>{res.title}</Text>
                    <Text style={styles.uploadSubtitle}>{res.workspaceName} • {res.type}</Text>
                  </View>
                  <Download size={20} color={colors.light.textMuted} />
                </AppCard>
              </Pressable>
            ))}
          </View>
        ) : (
          <AppCard padding="md">
            <Text style={{color: colors.light.textMuted}}>No recent resources found.</Text>
          </AppCard>
        )}

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
  verticalStack: {
    gap: spacing.md,
  },
  heroStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: radius.lg,
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
    borderRadius: radius.md,
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
