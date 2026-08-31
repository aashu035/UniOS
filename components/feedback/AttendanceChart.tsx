import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { colors, typography } from '../../tokens';
import { AttendanceMetrics } from '../../domains/attendance/viewmodel';

interface AttendanceChartProps {
  metrics: AttendanceMetrics;
  size?: number;
  strokeWidth?: number;
  onPrimary?: boolean;
}

export function AttendanceChart({ metrics, size = 120, strokeWidth = 12, onPrimary = false }: AttendanceChartProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  
  const isNull = metrics.percentage === null || metrics.denominator === 0;

  // On a metallic (primary) surface we invert the track + center text for contrast.
  const trackColor = onPrimary ? 'rgba(255,255,255,0.22)' : colors.light.border;
  const centerColor = onPrimary ? '#FFFFFF' : colors.light.text;

  // We want to show three segments: Present, Absent, Exempt
  const presentPct = isNull ? 0 : (metrics.present / metrics.denominator);
  const absentPct = isNull ? 0 : (metrics.absent / metrics.denominator);
  const exemptPct = isNull ? 0 : (metrics.exempt / metrics.denominator);

  const presentStroke = presentPct * circumference;
  const absentStroke = absentPct * circumference;
  const exemptStroke = exemptPct * circumference;

  // Calculate offsets for stacking the segments
  const presentOffset = circumference; // starts at top (0 offset if we don't rotate, but we strokeDashoffset from circumference)
  const exemptOffset = circumference - presentStroke;
  const absentOffset = exemptOffset - exemptStroke;

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
        
        {!isNull && (
          <G transform={`rotate(-90 ${size / 2} ${size / 2})`}>
            {/* Absent (Red) */}
            {absentPct > 0 && (
              <Circle
                stroke={(colors.light.attendanceStatus as any).absent.color}
                fill="none"
                cx={size / 2}
                cy={size / 2}
                r={radius}
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={circumference - absentStroke}
                // Rotate to start after present and exempt
                transform={`rotate(${(presentPct + exemptPct) * 360} ${size / 2} ${size / 2})`}
              />
            )}

            {/* Exempt (Yellow/Clock color) */}
            {exemptPct > 0 && (
              <Circle
                stroke={(colors.light.attendanceStatus as any).exempt.color}
                fill="none"
                cx={size / 2}
                cy={size / 2}
                r={radius}
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={circumference - exemptStroke}
                transform={`rotate(${presentPct * 360} ${size / 2} ${size / 2})`}
              />
            )}

            {/* Present (Green) */}
            {presentPct > 0 && (
              <Circle
                stroke={(colors.light.attendanceStatus as any).present.color}
                fill="none"
                cx={size / 2}
                cy={size / 2}
                r={radius}
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={circumference - presentStroke}
              />
            )}
          </G>
        )}
      </Svg>
      
      <View style={styles.textContainer}>
        <Text style={[styles.text, { fontSize: size * 0.22, color: centerColor }]}>
          {isNull ? '-' : `${metrics.percentage}%`}
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
