import React, { useState, useMemo } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { AppScaffold } from '../../components/layout/AppScaffold';
import { PageHeader } from '../../components/layout/PageHeader';
import { PageContainer } from '../../components/layout/PageContainer';
import { SectionHeader } from '../../components/layout/SectionHeader';
import { Skeleton } from '../../components/ui/Skeleton';
import { TimelineCard } from '../../components/cards/TimelineCard';
import { EmptyState } from '../../components/layout/EmptyState';
import { IconButton } from '../../components/buttons/IconButton';
import { Plus, Filter, Calendar as CalendarIcon } from 'lucide-react-native';
import { colors, spacing, typography, radius } from '../../tokens';
import { useRouter } from 'expo-router';
import { useCalendar } from '../../domains/calendar/hooks';

export default function Planner() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showStudySessions, setShowStudySessions] = useState(true);

  // Generate 7 days starting from today
  const dates = useMemo(() => {
    const arr = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      arr.push({
        dateObj: d,
        day: d.toLocaleDateString('en-US', { weekday: 'short' }),
        date: d.getDate(),
        isToday: i === 0,
      });
    }
    return arr;
  }, []);

  const dayOfWeek = selectedDate.getDay();
  const specificDateStr = selectedDate.toISOString().split('T')[0];

  const { events, isLoading } = useCalendar(dayOfWeek, specificDateStr);

  return (
    <AppScaffold>
      <PageHeader 
        title="Planner" 
        rightAction={
          <View style={styles.headerActions}>
            <IconButton icon={<Plus size={24} color={colors.light.text} />} onPress={() => router.push('/planner/add')} accessibilityLabel="Add event" />
          </View>
        }
      />
      
      {/* Date Selector Strip */}
      <View style={styles.dateStripContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateStrip}>
          {dates.map((d) => (
            <TouchableOpacity 
              key={d.dateObj.getTime()}
              activeOpacity={0.7}
              onPress={() => setSelectedDate(d.dateObj)}
              style={[styles.dateBubble, selectedDate.getDate() === d.date && styles.dateBubbleActive]}
            >
              <Text style={[styles.dateDay, selectedDate.getDate() === d.date && styles.dateTextActive]}>{d.day}</Text>
              <Text style={[styles.dateNumber, selectedDate.getDate() === d.date && styles.dateTextActive]}>{d.date}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <PageContainer>
        <SectionHeader title="Schedule" />
        
        {isLoading ? (
            <View style={{ padding: spacing.xl }}>
              <Skeleton height={80} borderRadius={radius.lg} style={{ marginBottom: spacing.md }} />
              <Skeleton height={80} borderRadius={radius.lg} style={{ marginBottom: spacing.md }} />
              <Skeleton height={80} borderRadius={radius.lg} />
            </View>
          ) : events.length > 0 ? (
          events.map((event, index) => (
            <TimelineCard 
              key={event.id}
              time={`${event.startTime} - ${event.endTime}`} 
              title={event.title || event.workspaceName || 'Event'} 
              subtitle={event.description || (event.type === 'work' ? 'External Work' : 'Lecture')} 
              venue={event.location || event.venueName || 'TBD'}
              isActive={index === 0 && selectedDate.getDate() === new Date().getDate()}
              onPress={event.workspaceId ? () => router.push(`/workspace/${event.workspaceId}`) : undefined}
            />
          ))
        ) : (
          <EmptyState 
            icon={<CalendarIcon size={48} color={colors.light.textMuted} />}
            title="Free Day"
            description="You don't have any classes or tasks scheduled for this day."
          />
        )}
      </PageContainer>
    </AppScaffold>
  );
}

const styles = StyleSheet.create({
  headerActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  dateStripContainer: {
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
    paddingBottom: spacing.md,
    backgroundColor: colors.light.background, // Ensure background matches so it looks cohesive
  },
  dateStrip: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  dateBubble: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: colors.light.surfaceElevated,
    minWidth: 56,
  },
  dateBubbleActive: {
    backgroundColor: colors.light.primary,
  },
  dateDay: {
    fontSize: typography.fontSize.xs,
    color: colors.light.textMuted,
    marginBottom: 4,
    textTransform: 'uppercase',
    fontWeight: typography.fontWeight.semibold,
  },
  dateNumber: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.light.text,
  },
  dateTextActive: {
    color: colors.dark.text, // Assuming dark text on primary background
  }
});
