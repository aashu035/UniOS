import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AppCard } from './AppCard';
import { colors, spacing, typography, borderRadius } from '../../tokens';
import { TrendingUp, TrendingDown } from 'lucide-react-native';

export interface StatCardProps {
  title: string;
  value: string;
  trend?: string;
  trendDirection?: 'up' | 'down';
  icon?: React.ReactNode;
  style?: any;
}

export function StatCard({ title, value, trend, trendDirection, icon, style }: StatCardProps) {
  return (
    <AppCard style={[styles.container, style]}>
      <View style={styles.header}>
        {icon && <View style={styles.iconContainer}>{icon}</View>}
        <Text style={styles.title}>{title}</Text>
      </View>
      <Text style={styles.value}>{value}</Text>
      {trend && (
        <View style={styles.trendContainer}>
          {trendDirection === 'up' && <TrendingUp size={14} color={colors.light.success} />}
          {trendDirection === 'down' && <TrendingDown size={14} color={colors.light.warning} />}
          <Text 
            style={[
              styles.trend, 
              trendDirection === 'up' && { color: colors.light.success },
              trendDirection === 'down' && { color: colors.light.warning },
            ]}
          >
            {trend}
          </Text>
        </View>
      )}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  iconContainer: {
    marginRight: spacing.sm,
  },
  title: {
    ...typography.label,
    color: colors.light.textMuted,
  },
  value: {
    ...typography.h3,
    marginBottom: spacing.xs,
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  trend: {
    ...typography.caption,
    color: colors.light.textMuted,
  }
});
