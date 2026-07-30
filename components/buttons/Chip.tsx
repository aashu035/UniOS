import React from 'react';
import { TouchableOpacity, Text, StyleSheet, TouchableOpacityProps } from 'react-native';
import { colors, radius, spacing, typography } from '../../tokens';

interface ChipProps extends TouchableOpacityProps {
  label: string;
  selected?: boolean;
}

export function Chip({ label, selected = false, disabled, style, ...props }: ChipProps) {
  return (
    <TouchableOpacity 
      style={[
        styles.chip,
        selected ? styles.selected : styles.unselected,
        disabled && styles.disabled,
        style
      ]} 
      disabled={disabled}
      activeOpacity={0.7}
      {...props}
    >
      <Text style={[
        styles.label,
        selected ? styles.labelSelected : styles.labelUnselected
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: radius.full,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  unselected: {
    backgroundColor: colors.light.surface,
    borderColor: colors.light.border,
  },
  selected: {
    backgroundColor: colors.light.primary,
    borderColor: colors.light.primary,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  labelUnselected: {
    color: colors.light.text,
  },
  labelSelected: {
    color: colors.dark.text,
  }
});
