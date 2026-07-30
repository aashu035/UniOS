import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, radius, spacing, typography } from '../../tokens';

interface TagProps {
  label: string;
  color?: string; // Hex color for the tag background
  style?: ViewStyle;
}

export function Tag({ label, color, style }: TagProps) {
  const backgroundColor = color ? `${color}20` : colors.light.surfaceElevated; // 20% opacity if color provided
  const textColor = color || colors.light.textMuted;
  
  return (
    <View style={[styles.container, { backgroundColor }, style]}>
      <Text style={[styles.label, { color: textColor }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.sm,
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  }
});
