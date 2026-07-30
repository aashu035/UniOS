import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Text } from 'react-native';
import { AppScaffold } from '../../components/layout/AppScaffold';
import { PageHeader } from '../../components/layout/PageHeader';
import { PageContainer } from '../../components/layout/PageContainer';
import { SectionHeader } from '../../components/layout/SectionHeader';
import { TimelineCard } from '../../components/cards/TimelineCard';
import { EmptyState } from '../../components/layout/EmptyState';
import { IconButton } from '../../components/buttons/IconButton';
import { Plus, Filter, Calendar as CalendarIcon } from 'lucide-react-native';
import { colors, spacing, typography, radius } from '../../tokens';

export default function Planner() {
  const [selectedDate, setSelectedDate] = useState(12);

  // Mock Date strip
  const dates = [
    { day: 'Mon', date: 10 },
    { day: 'Tue', date: 11 },
    { day: 'Wed', date: 12 },
    { day: 'Thu', date: 13 },
    { day: 'Fri', date: 14 },
    { day: 'Sat', date: 15 },
  ];

  return (
    <AppScaffold>
      <PageHeader 
        title="Planner" 
        rightAction={
          <View style={styles.headerActions}>
            <IconButton icon={<Filter size={24} color={colors.light.text} />} />
            <IconButton icon={<Plus size={24} color={colors.light.text} />} />
          </View>
        }
      />
      
      {/* Date Selector Strip */}
      <View style={styles.dateStripContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateStrip}>
          {dates.map((d) => (
            <TouchableOpacity 
              key={d.date}
              activeOpacity={0.7}
              onPress={() => setSelectedDate(d.date)}
              style={[styles.dateBubble, selectedDate === d.date && styles.dateBubbleActive]}
            >
              <Text style={[styles.dateDay, selectedDate === d.date && styles.dateTextActive]}>{d.day}</Text>
              <Text style={[styles.dateNumber, selectedDate === d.date && styles.dateTextActive]}>{d.date}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <PageContainer>
        <SectionHeader title="Schedule" />
        
        {selectedDate === 12 ? (
          <>
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
            <TimelineCard 
              time="02:00 PM" 
              title="Study Group: OS Project" 
              subtitle="Self Study" 
              venue="Central Library"
            />
          </>
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
