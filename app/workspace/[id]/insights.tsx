import React from 'react';
import { View, StyleSheet, ScrollView, Text } from 'react-native';
import { PageContainer } from '../../../components/layout/PageContainer';
import { AppCard } from '../../../components/cards/AppCard';
import { SectionHeader } from '../../../components/layout/SectionHeader';
import { EmptyState } from '../../../components/layout/EmptyState';
import { LineChart, BarChart3 } from 'lucide-react-native';
import { colors, spacing, typography } from '../../../tokens';

export default function WorkspaceInsights() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PageContainer>
        <SectionHeader title="Performance Trend" />
        <AppCard style={styles.chartPlaceholder} padding="none">
          <View style={styles.placeholderInner}>
            <LineChart size={48} color={colors.light.border} />
            <Text style={styles.placeholderText}>More data needed to generate trends</Text>
          </View>
        </AppCard>

        <SectionHeader title="Comparison" />
        <AppCard style={styles.chartPlaceholder} padding="none">
          <View style={styles.placeholderInner}>
            <BarChart3 size={48} color={colors.light.border} />
            <Text style={styles.placeholderText}>Class average insights unlock after Midterms</Text>
          </View>
        </AppCard>
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
  chartPlaceholder: {
    height: 200,
    marginBottom: spacing.lg,
  },
  placeholderInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.light.surfaceElevated,
    borderRadius: 16, // matches radius.lg typically
    gap: spacing.sm,
  },
  placeholderText: {
    fontSize: typography.fontSize.sm,
    color: colors.light.textMuted,
  }
});
