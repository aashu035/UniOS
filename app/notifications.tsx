import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AppScaffold } from '../components/layout/AppScaffold';
import { PageHeader } from '../components/layout/PageHeader';
import { PageContainer } from '../components/layout/PageContainer';
import { IconButton } from '../components/buttons/IconButton';
import { EmptyState } from '../components/layout/EmptyState';
import { X, BellOff } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { colors } from '../tokens';

export default function NotificationsModal() {
  const router = useRouter();

  return (
    <AppScaffold>
      <PageHeader 
        title="Inbox" 
        rightAction={<IconButton icon={<X size={24} color={colors.light.text} />} onPress={() => router.back()} />}
      />
      <PageContainer>
        <EmptyState 
          icon={<BellOff size={48} color={colors.light.textMuted} />}
          title="All caught up"
          description="You don't have any new notifications."
        />
      </PageContainer>
    </AppScaffold>
  );
}
