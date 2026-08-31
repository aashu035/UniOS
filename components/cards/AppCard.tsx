import React from 'react';
import { View, StyleSheet, ViewProps } from 'react-native';
import { colors, radius, spacing } from '../../tokens';
import { glassCard } from '../../tokens/surface';

export interface AppCardProps extends ViewProps {
  children: React.ReactNode;
  variant?: 'elevated' | 'outlined' | 'flat' | 'glass' | 'glassPrimary';
  padding?: keyof typeof spacing;
}

export const AppCard = React.memo(function AppCard({
  children,
  variant = 'elevated',
  padding = 'lg',
  style,
  ...props
}: AppCardProps) {
  // 'glassPrimary' renders a branded metallic surface; the inner highlight + sheen
  // are applied via the glassCard preset. We keep overflow hidden so children clip
  // nicely to the rounded corners.
  return (
    <View
      style={[
        styles.base,
        variant === 'glass' && glassCard.neutral,
        variant === 'glassPrimary' && glassCard.primary,
        (variant === 'elevated') && styles.elevated,
        (variant === 'outlined') && styles.outlined,
        (variant === 'flat') && styles.flat,
        { padding: spacing[padding] },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
});

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.xl,
    backgroundColor: colors.light.surfaceElevated,
    overflow: 'hidden',
  },
  elevated: {
    ...glassCard.neutral,
  },
  outlined: {
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: 'transparent',
  },
  flat: {
    backgroundColor: colors.light.surface,
  },
});
