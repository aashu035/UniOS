import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { AppCard } from './AppCard';
import { colors, spacing, typography, radius } from '../../tokens';
import { Check, X, CalendarOff, BookOpen, FlaskConical } from 'lucide-react-native';

export type AttendanceStatusType = 'present' | 'absent' | 'exempt' | 'cancelled';
export type AttendanceComponentType = 'theory' | 'lab' | string;

interface AttendanceItemProps {
  date?: string;
  status: AttendanceStatusType;
  type: AttendanceComponentType;
  notes?: string;
  onPress?: () => void;
  onLongPress?: () => void;
  time?: string;
  isTimeline?: boolean;
}

export const AttendanceItem = React.memo(function AttendanceItem({ 
  date, 
  status, 
  type, 
  notes, 
  onPress, 
  onLongPress,
  time,
  isTimeline = true
}: AttendanceItemProps) {
  
  // Status controls the primary state color (green/red)
  const statusToken = (colors.light.attendanceStatus as any)[status] || { color: colors.light.text, border: colors.light.border, bg: colors.light.surface };
  const StatusIcon = status === 'present' || status === 'exempt' ? Check : status === 'absent' ? X : CalendarOff;
  const statusLabel = status === 'exempt' ? 'On Leave' : status.charAt(0).toUpperCase() + status.slice(1);

  // Type controls the secondary category color (blue/amber)
  const typeKey = type === 'theory' || type === 'lab' ? type : 'theory'; // fallback
  const typeToken = (colors.light.attendanceType as any)[typeKey];
  const TypeIcon = type === 'lab' ? FlaskConical : BookOpen;
  const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);

  const CardWrapper = onPress || onLongPress ? TouchableOpacity : View;

  const cardContent = (
    <AppCard 
      style={[
        styles.card, 
        { borderLeftColor: statusToken.color, borderLeftWidth: 4 }
      ]}
    >
      <View style={styles.cardInner}>
        <View style={styles.contentCol}>
          <View style={styles.statusRow}>
            <StatusIcon size={16} color={statusToken.color} strokeWidth={3} />
            <Text style={[styles.statusTitle, { color: statusToken.color }]}>{statusLabel}</Text>
          </View>
          
          <View style={styles.typeRow}>
            <View style={[styles.typeIconContainer, { backgroundColor: typeToken.bg }]}>
              <TypeIcon size={14} color={typeToken.color} />
            </View>
            <View style={[styles.typeDot, { backgroundColor: typeToken.color }]} />
            <Text style={[styles.typeLabel, { color: typeToken.color }]}>
              {typeLabel} {notes ? ` • ${notes}` : ''}
            </Text>
          </View>
        </View>
        {time && (
          <Text style={styles.timeLabel}>{time}</Text>
        )}
      </View>
    </AppCard>
  );

  const wrappedContent = (
    <CardWrapper 
      activeOpacity={0.7} 
      onPress={onPress} 
      onLongPress={onLongPress}
    >
      {cardContent}
    </CardWrapper>
  );

  if (!isTimeline) {
    return wrappedContent;
  }

  return (
    <View style={styles.timelineContainer}>
      <View style={styles.timelineColumn}>
        {date && <Text style={styles.dateText}>{date}</Text>}
        <View style={[styles.timelineMarker, { backgroundColor: statusToken.color }]}>
           <StatusIcon size={12} color="#FFF" strokeWidth={3} />
        </View>
        <View style={[styles.timelineLine, { backgroundColor: statusToken.color }]} />
      </View>
      <View style={styles.timelineCardColumn}>
        {wrappedContent}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  timelineContainer: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  timelineColumn: {
    width: 65,
    alignItems: 'center',
    marginRight: spacing.md,
  },
  dateText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.light.textMuted,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  timelineMarker: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
    zIndex: 2,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    borderRadius: 1,
  },
  timelineCardColumn: {
    flex: 1,
    paddingBottom: spacing.lg,
  },
  card: {
    padding: spacing.md,
    backgroundColor: colors.light.background,
  },
  cardInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  contentCol: {
    flex: 1,
    gap: spacing.sm,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statusTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  typeIconContainer: {
    padding: 4,
    borderRadius: radius.sm,
  },
  typeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: spacing.xs,
  },
  typeLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  timeLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.light.textMuted,
  }
});
