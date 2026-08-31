import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors, typography } from '../../tokens';

interface AttendanceRingProps {
  percentage: number | null;
  size?: number;
  strokeWidth?: number;
  onPrimary?: boolean;
}

export function AttendanceRing({ percentage, size = 64, strokeWidth = 6, onPrimary = false }: AttendanceRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  
  const isNull = percentage === null;
  const safePercentage = isNull ? 100 : percentage;
  const strokeDashoffset = isNull ? 0 : circumference - (safePercentage / 100) * circumference;

  // On a metallic (primary) surface we invert the track + center text for contrast.
  const trackColor = onPrimary ? 'rgba(255,255,255,0.22)' : colors.light.border;
  const centerColor = onPrimary ? '#FFFFFF' : colors.light.text;

  // Color logic based on percentage
  const getRingColor = () => {
    if (isNull) return onPrimary ? 'rgba(255,255,255,0.55)' : colors.light.border; // Gray ring for null
    if (safePercentage >= 75) return colors.light.success;
    if (safePercentage >= 60) return colors.light.warning;
    return colors.light.danger;
  };

  const ringColor = getRingColor();

  return (
    <View style={[{ width: size, height: size }, styles.container]}>
      <Svg width={size} height={size} style={styles.svg}>
        {/* Background Ring */}
        <Circle
          stroke={trackColor}
          fill="none"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
        />
        {/* Progress Ring */}
        <Circle
          stroke={ringColor}
          fill="none"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          // Rotate to start from top (-90 degrees)
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.textContainer}>
        <Text style={[styles.text, { fontSize: size * 0.25, color: centerColor }]}>
          {isNull ? '-' : `${Math.round(safePercentage)}%`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  svg: {
    position: 'absolute',
  },
  textContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: typography.fontWeight.bold,
    color: colors.light.text,
  }
});
