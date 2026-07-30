import React from 'react';
import { View, Text, StyleSheet, TextInput } from 'react-native';
import { AppScaffold } from '../components/layout/AppScaffold';
import { PageContainer } from '../components/layout/PageContainer';
import { IconButton } from '../components/buttons/IconButton';
import { EmptyState } from '../components/layout/EmptyState';
import { X, Search as SearchIcon } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { colors, radius, spacing, typography } from '../tokens';

export default function SearchModal() {
  const router = useRouter();

  return (
    <AppScaffold>
      <View style={styles.header}>
        <View style={styles.searchBar}>
          <SearchIcon size={20} color={colors.light.textMuted} />
          <TextInput 
            style={styles.input}
            placeholder="Search workspaces, tasks, resources..."
            placeholderTextColor={colors.light.textMuted}
            autoFocus
          />
        </View>
        <IconButton icon={<X size={24} color={colors.light.text} />} onPress={() => router.back()} />
      </View>
      <PageContainer>
        <EmptyState 
          icon={<SearchIcon size={48} color={colors.light.textMuted} />}
          title="Global Search"
          description="Find anything across all your workspaces."
        />
      </PageContainer>
    </AppScaffold>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.light.surfaceElevated,
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    height: 48,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: typography.fontSize.base,
    color: colors.light.text,
  }
});
