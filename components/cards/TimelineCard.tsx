import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { AppCard } from './AppCard';
import { colors, spacing, typography, radius } from '../../tokens';
import { MapPin, Clock } from 'lucide-react-native';

interface TimelineCardProps {
  time: string;
  title: string;
  subtitle: string;
  venue?: string;
  isActive?: boolean;
  onPress?: () => void;
}

export const TimelineCard = React.memo(function TimelineCard({ time, title, subtitle, venue, isActive = false, onPress }: TimelineCardProps) {
  const CardWrapper = onPress ? React.Fragment : View;
  
  return (
    <View style={styles.container}>
      {/* Time Column */}
      <View style={styles.timeColumn}>
        <Text style={[styles.timeText, isActive && styles.activeTimeText]}>{time}</Text>
        <View style={[styles.dot, isActive && styles.activeDot]} />
        <View style={styles.line} />
      </View>

      {/* Card Column */}
      <View style={styles.cardColumn}>
        {onPress ? (
          <TouchableOpacity activeOpacity={0.7} onPress={onPress}>
            <AppCard 
              variant={isActive ? 'elevated' : 'flat'} 
              style={[styles.card, isActive && styles.activeCard]}
            >
              <Text style={[styles.title, isActive && styles.activeText]}>{title}</Text>
              <Text style={[styles.subtitle, isActive && styles.activeSubText]}>{subtitle}</Text>
              
              {venue && (
                <View style={styles.footer}>
                  <MapPin size={14} color={isActive ? colors.dark.text : colors.light.textMuted} />
                  <Text style={[styles.venueText, isActive && styles.activeSubText]}>{venue}</Text>
                </View>
              )}
            </AppCard>
          </TouchableOpacity>
        ) : (
          <AppCard 
            variant={isActive ? 'elevated' : 'flat'} 
            style={[styles.card, isActive && styles.activeCard]}
          >
            <Text style={[styles.title, isActive && styles.activeText]}>{title}</Text>
            <Text style={[styles.subtitle, isActive && styles.activeSubText]}>{subtitle}</Text>
            
            {venue && (
              <View style={styles.footer}>
                <MapPin size={14} color={isActive ? colors.dark.text : colors.light.textMuted} />
                <Text style={[styles.venueText, isActive && styles.activeSubText]}>{venue}</Text>
              </View>
            )}
          </AppCard>
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
    marginBottom: spacing.sm,
  },
  activeTimeText: {
    color: colors.light.primary,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.light.border,
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
    paddingBottom: spacing.lg, // Space for the line to continue
  },
  card: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  activeCard: {
    backgroundColor: colors.light.primary,
  },
  title: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.light.text,
    marginBottom: 2,
  },
  activeText: {
    color: colors.dark.text, // Assuming dark text looks good on primary (if primary is light) or vice versa. Usually primary is dark, so text should be light. Wait, the tokens setup was primary = #6366F1, so text on it should be white (which is `colors.dark.text` in this inverse logic, or we just hardcode '#fff'). Let's use '#fff' for clarity on dark buttons.
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.light.textMuted,
    marginBottom: spacing.sm,
  },
  activeSubText: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  venueText: {
    fontSize: typography.fontSize.xs,
    color: colors.light.textMuted,
    marginLeft: spacing.xs,
    fontWeight: typography.fontWeight.medium,
  }
});
