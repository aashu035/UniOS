import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { AppCard } from './AppCard';
import { colors, spacing, typography, radius } from '../../tokens';
import { onPrimary } from '../../tokens/surface';
import { MapPin, Clock } from 'lucide-react-native';

interface TimelineCardProps {
  time: string;
  title: string;
  subtitle: string;
  /** Optional end time shown under `time` in the time column. */
  endTime?: string;
  /** Optional venue line under the subtitle. Omit when undefined (no fake "TBA"). */
  venue?: string;
  isActive?: boolean;
  onPress?: () => void;
  /** Fable's home design adds these. All optional — fully backward compatible. */
  accentColor?: string;
  icon?: React.ReactNode;
  /** Fable's home design: small badge (e.g. "MOVE" for schedule exceptions). */
  badge?: string;
}

export const TimelineCard = React.memo(function TimelineCard({
  time,
  endTime,
  title,
  subtitle,
  venue,
  isActive = false,
  onPress,
  accentColor,
  icon,
  badge,
}: TimelineCardProps) {
  const CardWrapper = onPress ? React.Fragment : View;
  const accent = accentColor ?? colors.light.primary;
  const iconBg = isActive ? onPrimary.track : `${accent}20`;
  const iconFg = isActive ? onPrimary.title : accent;

  const content = (
    <AppCard
      variant={isActive ? 'elevated' : 'flat'}
      style={[styles.card, isActive && styles.activeCard]}
    >
      <View style={styles.headerRow}>
        {icon ? (
          <View style={[styles.iconWell, { backgroundColor: iconBg }]}>
            {/* @ts-ignore — lucide icons accept `color` prop */}
            {React.isValidElement(icon) ? React.cloneElement(icon as any, { color: iconFg }) : icon}
          </View>
        ) : null}
        <View style={styles.textColumn}>
          <Text style={[styles.title, isActive && styles.activeText]} numberOfLines={1}>{title}</Text>
          <Text style={[styles.subtitle, isActive && styles.activeSubText]} numberOfLines={1}>{subtitle}</Text>
        </View>
        {badge ? (
          <View style={[styles.badge, isActive ? styles.badgeOnPrimary : styles.badgeNeutral]}>
            <Text style={[styles.badgeText, isActive ? styles.badgeTextOnPrimary : styles.badgeTextNeutral]}>
              {badge}
            </Text>
          </View>
        ) : null}
      </View>

      {venue ? (
        <View style={styles.footer}>
          <MapPin size={14} color={isActive ? onPrimary.subtitle : colors.light.textMuted} />
          <Text style={[styles.venueText, isActive && styles.activeSubText]}>{venue}</Text>
        </View>
      ) : null}
    </AppCard>
  );

  return (
    <View style={styles.container}>
      {/* Time Column */}
      <View style={styles.timeColumn}>
        <Text style={[styles.timeText, isActive && styles.activeTimeText]}>{time}</Text>
        {endTime ? (
          <Text style={[styles.endTimeText, isActive && styles.activeTimeText]}>{endTime}</Text>
        ) : null}
        <View style={[styles.dot, isActive && styles.activeDot, !isActive && accentColor ? { backgroundColor: accentColor } : null]} />
        <View style={styles.line} />
      </View>

      {/* Card Column */}
      <View style={styles.cardColumn}>
        {onPress ? (
          <TouchableOpacity activeOpacity={0.7} onPress={onPress}>
            {content}
          </TouchableOpacity>
        ) : (
          content
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  timeColumn: {
    width: 60,
    alignItems: 'center',
    marginRight: spacing.md,
  },
  timeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.light.textMuted,
    lineHeight: 14,
  },
  endTimeText: {
    fontSize: typography.fontSize.xs,
    color: colors.light.textMuted,
    marginTop: 2,
    lineHeight: 14,
  },
  activeTimeText: {
    color: colors.light.primary,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.light.border,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  activeDot: {
    backgroundColor: colors.light.primary,
    borderWidth: 3,
    borderColor: `${colors.light.primary}30`,
  },
  line: {
    width: 2,
    flex: 1,
    backgroundColor: colors.light.border,
    borderRadius: 1,
  },
  cardColumn: {
    flex: 1,
    paddingBottom: spacing.lg,
  },
  card: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  activeCard: {
    backgroundColor: colors.light.primary,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconWell: {
    width: 36,
    height: 36,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  textColumn: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.light.text,
    marginBottom: 2,
  },
  activeText: {
    color: onPrimary.title,
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.light.textMuted,
  },
  activeSubText: {
    color: 'rgba(255, 255, 255, 0.82)',
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    flexShrink: 0,
  },
  badgeNeutral: {
    backgroundColor: `${colors.light.warning}20`,
  },
  badgeOnPrimary: {
    backgroundColor: onPrimary.track,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: typography.fontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.wide,
  },
  badgeTextNeutral: { color: colors.light.warning },
  badgeTextOnPrimary: { color: onPrimary.title },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  venueText: {
    fontSize: typography.fontSize.xs,
    color: colors.light.textMuted,
    marginLeft: spacing.xs,
    fontWeight: typography.fontWeight.medium,
  },
});
