import React from 'react';
import { View, StyleSheet, ScrollView, Alert, Linking, Text } from 'react-native';
import { PageContainer } from '../../../components/layout/PageContainer';
import { SectionHeader } from '../../../components/layout/SectionHeader';
import { ResourceCard } from '../../../components/cards/ResourceCard';
import { IconButton } from '../../../components/buttons/IconButton';
import { Plus } from 'lucide-react-native';
import { colors, spacing } from '../../../tokens';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useResources } from '../../../domains/resource/hooks';

export default function WorkspaceKnowledgeHub() {
  const { id } = useLocalSearchParams();
  const workspaceId = parseInt(id as string, 10);
  const { resources, isLoading, refreshResources } = useResources(workspaceId);
  const router = useRouter();

  const openResource = async (res: any) => {
    if (res.type === 'note') {
      router.push(`/resource/${res.id}`);
      return;
    }
    
    if (res.type === 'file') {
      // Navigate to the offline viewer with the filename (relative UUID)
      router.push(`/resource/viewer?id=${res.id}&filename=${res.uri}&title=${encodeURIComponent(res.title)}`);
      return;
    }
    
    try {
      if (res.uri && await Linking.canOpenURL(res.uri)) {
        await Linking.openURL(res.uri);
      } else {
        Alert.alert('Cannot open resource', 'This resource does not have a valid link.');
      }
    } catch (error) {
      console.error('Could not open resource', error);
      Alert.alert('Cannot open resource', 'Please try again.');
    }
  };

  const handleResourceOptions = (res: any) => {
    Alert.alert(
      'Resource Options',
      res.title,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Confirm Delete',
              'Are you sure you want to delete this resource?',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      const { ResourceRepository } = require('../../../domains/resource/repository');
                      await ResourceRepository.deleteResource(res.id);
                      
                      // Refresh the UI
                      refreshResources();
                      
                      Alert.alert('Success', 'Resource deleted');
                    } catch (error) {
                      console.error('Failed to delete resource', error);
                      Alert.alert('Error', 'Failed to delete resource');
                    }
                  }
                }
              ]
            );
          }
        }
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PageContainer>
        <SectionHeader 
          title="All Resources & Notes" 
          action={
            <IconButton 
              icon={<Plus size={20} color={colors.light.primary} />} 
              onPress={() => router.push(`/resource/add?workspaceId=${workspaceId}`)} 
              accessibilityLabel="Add resource" 
            />
          }
        />
        {resources.length > 0 ? (
          resources.map(res => (
            <ResourceCard 
              key={res.id}
              title={res.title} 
              type={res.type} 
              metadata={res.type === 'note' ? 'Text Note' : `${res.type.toUpperCase()} • ${res.sizeBytes ? (res.sizeBytes / 1024 / 1024).toFixed(1) + ' MB' : 'Link'}`} 
              thumbnailUrl={res.thumbnailUrl}
              onPress={() => openResource(res)}
              onMorePress={() => handleResourceOptions(res)}
            />
          ))

        ) : (
          <View style={{ padding: spacing.xl, alignItems: 'center' }}>
            <Text style={{ color: colors.light.textMuted }}>No resources found. Tap + to add one.</Text>
          </View>
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
  }
});
