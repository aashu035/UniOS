import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { PageContainer } from '../../../components/layout/PageContainer';
import { SectionHeader } from '../../../components/layout/SectionHeader';
import { StatCard } from '../../../components/cards/StatCard';
import { TimelineCard } from '../../../components/cards/TimelineCard';
import { FacultyCard } from '../../../components/cards/FacultyCard';
import { colors, spacing } from '../../../tokens';
import { BookOpen, AlertTriangle } from 'lucide-react-native';
import { useLocalSearchParams } from 'expo-router';
import { useWorkspace } from '../../../domains/workspace/hooks';

export default function WorkspaceOverview() {
  const { id } = useLocalSearchParams();
  const workspaceId = parseInt(id as string, 10);
  const { workspaceData, timeline, isLoading } = useWorkspace(workspaceId);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PageContainer>
        <View style={styles.statsRow}>
          <StatCard 
            title="Attendance" 
            value="85%" 
            trend="+2% this week"
            trendDirection="up"
            icon={<BookOpen size={20} color={colors.light.primary} />}
            style={styles.flexHalf}
          />
          <StatCard 
            title="Alerts" 
            value="1" 
            trend="Midterm next week"
            trendDirection="down"
            icon={<AlertTriangle size={20} color={colors.light.warning} />}
            style={styles.flexHalf}
          />
        </View>

        <SectionHeader title="Faculty" />
        <FacultyCard 
          name="Prof. Sharma"
          title="Course Instructor"
          email="sharma@dcrust.edu.in"
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
          <>
            <TimelineCard 
              time="Today" 
              title="Uploaded Slide Deck: Trees & Graphs" 
              subtitle="Knowledge Hub" 
              venue="PDF • 2.4 MB"
              isActive={true}
            />
            <TimelineCard 
              time="Yesterday" 
              title="Graded Assignment 2" 
              subtitle="Tasks" 
              venue="Score: 18/20"
            />
            <TimelineCard 
              time="Mon, 10th" 
              title="Midterm Syllabus Announced" 
              subtitle="Announcement" 
              venue="Chapters 1-5"
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
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  flexHalf: {
    flex: 1,
  }
});
