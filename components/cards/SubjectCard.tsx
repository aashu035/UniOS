import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { AppCard } from './AppCard';
import { AttendanceRing } from '../feedback/AttendanceRing';
import { colors, spacing, typography } from '../../tokens';

import { useAttendanceMetrics } from '../../domains/attendance/hooks';

interface SubjectCardProps {
  title: string;
  code: string;
  attendancePercentage?: number;
  workspaceId?: number;
  onPress?: () => void;
}

export function SubjectCard({ title, code, attendancePercentage, workspaceId, onPress }: SubjectCardProps) {
  let displayPercentage = attendancePercentage || 100;
  
  const { metrics, isLoading } = useAttendanceMetrics(workspaceId || -1);
  let hasData = true;
  if (workspaceId && !isLoading) {
    displayPercentage = metrics.percentage;
    hasData = metrics.hasData;
  }

  const content = (
    <AppCard padding="lg" style={styles.card}>
      <View style={styles.textContainer}>
        <Text style={styles.code}>{code}</Text>
        <Text style={styles.title} numberOfLines={2}>{title}</Text>
      </View>
      <View style={styles.ringContainer}>
        <AttendanceRing percentage={displayPercentage} size={56} strokeWidth={5} />
      </View>
    </AppCard>
  );

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.8} onPress={onPress}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  textContainer: {
    flex: 1,
    paddingRight: spacing.md,
  },
  code: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.light.primary,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.light.text,
    lineHeight: typography.lineHeight.base,
  },
  ringContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  }
});
