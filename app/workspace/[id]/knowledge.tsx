import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { PageContainer } from '../../../components/layout/PageContainer';
import { SectionHeader } from '../../../components/layout/SectionHeader';
import { ResourceCard } from '../../../components/cards/ResourceCard';
import { colors, spacing } from '../../../tokens';
import { useLocalSearchParams } from 'expo-router';
import { useResources } from '../../../domains/resource/hooks';

export default function WorkspaceKnowledgeHub() {
  const { id } = useLocalSearchParams();
  const workspaceId = parseInt(id as string, 10);
  const { resources, isLoading } = useResources(workspaceId);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PageContainer>
        <SectionHeader title="Recent Uploads" actionLabel="See All" />
        {resources.length > 0 ? (
          resources.map(res => (
            <ResourceCard 
              key={res.id}
              title={res.title} 
              type={res.type} 
              metadata={`${res.type.toUpperCase()} • ${res.sizeBytes ? (res.sizeBytes / 1024 / 1024).toFixed(1) + ' MB' : 'Link'} • Uploaded recently`} 
            />
          ))
        ) : (
          <>
            <ResourceCard 
              title="Chapter 4: Trees & Graphs" 
              type="pdf" 
              metadata="PDF • 2.4 MB • Uploaded Today" 
            />
            <ResourceCard 
              title="Lecture 12 Recording" 
              type="video" 
              metadata="MP4 • 142 MB • Uploaded Yesterday" 
            />
          </>
        )}

        <SectionHeader title="Syllabus & Books" />
        <ResourceCard 
          title="Course Syllabus (2025-26)" 
          type="pdf" 
          metadata="PDF • 450 KB" 
        />
        <ResourceCard 
          title="Data Structures by Seymour Lipschutz" 
          type="link" 
          metadata="External Link • E-Library" 
        />
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
  }
});
