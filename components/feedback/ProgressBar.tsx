import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors, radius } from '../../tokens';

interface ProgressBarProps {
  progress: number; // 0 to 100
  color?: string;
  height?: number;
  style?: ViewStyle;
}

export function ProgressBar({ progress, color = colors.light.primary, height = 8, style }: ProgressBarProps) {
  // Clamp progress between 0 and 100
  const clampedProgress = Math.min(Math.max(progress, 0), 100);

  return (
    <View style={[styles.container, { height }, style]}>
      <View 
        style={[
          styles.fill, 
          { 
            width: `${clampedProgress}%`, 
            backgroundColor: color 
          }
        ]} 
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: colors.light.surfaceElevated,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.full,
  }
});
