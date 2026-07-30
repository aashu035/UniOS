import React from 'react';
import { View, StyleSheet, ViewProps, ViewStyle } from 'react-native';
import { colors, radius, elevation, spacing } from '../../tokens';

export interface AppCardProps extends ViewProps {
  children: React.ReactNode;
  variant?: 'elevated' | 'outlined' | 'flat';
  padding?: keyof typeof spacing;
  style?: ViewStyle;
}

export function AppCard({ 
  children, 
  variant = 'elevated', 
  padding = 'lg',
  style, 
  ...props 
}: AppCardProps) {
  return (
    <View 
      style={[
        styles.base,
        styles[variant],
        { padding: spacing[padding] },
        style
      ]} 
      {...props}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.xl,
    backgroundColor: colors.light.surfaceElevated,
    overflow: 'hidden',
  },
  elevated: {
    ...elevation.sm,
  },
  outlined: {
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: 'transparent',
  },
  flat: {
    backgroundColor: colors.light.surface,
  }
});
