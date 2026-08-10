import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { AppCard } from './AppCard';
import { colors, spacing, typography } from '../../tokens';
import { TrendingUp, TrendingDown } from 'lucide-react-native';

export interface StatCardProps {
  title: string;
  value: string;
  trend?: string;
  trendDirection?: 'up' | 'down';
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
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
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.light.textMuted,
  },
  value: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.light.text,
    marginBottom: spacing.xs,
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  trend: {
    fontSize: typography.fontSize.xs,
    color: colors.light.textMuted,
  }
});
