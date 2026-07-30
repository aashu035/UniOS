import React from 'react';
import { TouchableOpacity, Text, StyleSheet, TouchableOpacityProps, ActivityIndicator } from 'react-native';
import { colors, radius, spacing, typography } from '../../tokens';

interface PrimaryButtonProps extends TouchableOpacityProps {
  label: string;
  loading?: boolean;
}

export function PrimaryButton({ label, loading, disabled, style, ...props }: PrimaryButtonProps) {
  return (
    <TouchableOpacity 
      style={[
        styles.button,
        (disabled || loading) && styles.disabled,
        style
      ]} 
      disabled={disabled || loading}
      activeOpacity={0.8}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={colors.dark.text} />
      ) : (
        <Text style={styles.label}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.light.primary,
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    color: colors.dark.text, // Text on primary is light
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  }
});
