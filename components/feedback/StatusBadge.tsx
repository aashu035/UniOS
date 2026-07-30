import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, radius, spacing, typography } from '../../tokens';

type StatusVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';

interface StatusBadgeProps {
  label: string;
  variant?: StatusVariant;
  style?: ViewStyle;
}

export function StatusBadge({ label, variant = 'neutral', style }: StatusBadgeProps) {
  return (
    <View style={[styles.container, styles[variant], style]}>
      <Text style={[styles.label, styles[`${variant}Text` as keyof typeof styles]]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  
  // Variants
  success: {
    backgroundColor: `${colors.light.success}20`,
  },
  successText: {
    color: colors.light.success,
  },
  
  warning: {
    backgroundColor: `${colors.light.warning}20`,
  },
  warningText: {
    color: colors.light.warning,
  },
  
  error: {
    backgroundColor: `${colors.light.error}20`,
  },
  errorText: {
    color: colors.light.error,
  },
  
  info: {
    backgroundColor: `${colors.light.primary}20`,
  },
  infoText: {
    color: colors.light.primary,
  },
  
  neutral: {
    backgroundColor: colors.light.surfaceElevated,
  },
  neutralText: {
    color: colors.light.textMuted,
  },
});
