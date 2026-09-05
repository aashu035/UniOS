import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '../../tokens';
import { onPrimary } from '../../tokens/surface';

interface FrostedChipProps {
  value: number;
  label: string;
  icon?: React.ReactNode;
}

/**
 * NEW_PRIMITIVE (Fable's home design): a translucent-on-primary pill.
 * Used on the Academic Pulse hero to show the four weather facts
 * (classes / labs / due / exams) without competing with the headline.
 *
 * Uses the hoisted `onPrimary.track` so the translucent value lives in
 * exactly one place. Zero-valued chips render at 0.55 opacity so the
 * layout stays stable but the user can tell a real 0 from a missing chip.
 */
export function FrostedChip({ value, label, icon }: FrostedChipProps) {
  const isZero = value === 0;
  return (
    <View style={[styles.chip, isZero && styles.chipZero]}>
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: radius.full,
    backgroundColor: onPrimary.track,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.35)',
  },
  chipZero: {
    opacity: 0.55,
  },
  icon: {
    // Icons (lucide) inherit color via their `color` prop at the call site.
    // This View is just a layout slot.
  },
  value: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: onPrimary.title,
    fontVariant: ['tabular-nums'],
  },
  label: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: onPrimary.subtitle,
  },
});
