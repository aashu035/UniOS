import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { AppCard } from './AppCard';
import { AttendanceRing } from '../feedback/AttendanceRing';
import { CourseIcon } from '../ui/CourseIcon';
import { MapPin } from 'lucide-react-native';
import { colors, spacing, typography } from '../../tokens';

import { useAttendanceMetrics } from '../../domains/attendance/hooks';

interface SubjectCardProps {
  title: string;
  code: string;
  attendancePercentage?: number | null;
  workspaceId?: number;
  onPress?: () => void;
  /** Lucide icon name (matches CourseIcon registry). Optional — falls back to plain text. */
  iconName?: string | null;
  /** Hex color used for the icon background tint + ring color. */
  iconColor?: string;
  /** Optional venue label rendered under the title. */
  venue?: string | null;
}

export function SubjectCard({
  title,
  code,
  attendancePercentage,
  workspaceId,
  onPress,
  iconName,
  iconColor,
  venue,
}: SubjectCardProps) {
  let displayPercentage: number | null = attendancePercentage ?? 100;

  const { metrics, isLoading } = useAttendanceMetrics(workspaceId || -1);
  let hasData = true;
  if (workspaceId && !isLoading) {
    displayPercentage = metrics.percentage;
    hasData = metrics.hasData;
  }

  const accent = iconColor || colors.light.primary;

  const content = (
    <AppCard padding="lg" style={styles.card}>
      {iconName ? (
        <View style={[styles.iconBadge, { backgroundColor: accent + '20' }]}>
          <CourseIcon name={iconName} size={22} color={accent} />
        </View>
      ) : null}
      <View style={styles.textContainer}>
        <Text style={[styles.code, { color: accent }]}>{code}</Text>
        <Text style={styles.title} numberOfLines={2}>{title}</Text>
        {venue ? (
          <View style={styles.venueRow}>
            <MapPin size={12} color={colors.light.textMuted} />
            <Text style={styles.venueText} numberOfLines={1}>{venue}</Text>
          </View>
        ) : null}
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
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  textContainer: {
    flex: 1,
    paddingRight: spacing.md,
  },
  code: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.light.text,
    lineHeight: typography.lineHeight.base,
  },
  venueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  venueText: {
    fontSize: typography.fontSize.xs,
    color: colors.light.textMuted,
    flexShrink: 1,
  },
  ringContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  }
});
