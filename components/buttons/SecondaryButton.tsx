import React from 'react';
import { TouchableOpacity, Text, StyleSheet, TouchableOpacityProps, ActivityIndicator } from 'react-native';
import { colors, radius, spacing, typography } from '../../tokens';

interface SecondaryButtonProps extends TouchableOpacityProps {
  label: string;
  loading?: boolean;
}

export function SecondaryButton({ label, loading, disabled, style, ...props }: SecondaryButtonProps) {
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
        <ActivityIndicator color={colors.light.primary} />
      ) : (
        <Text style={styles.label}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.light.surfaceElevated,
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.light.border,
    minHeight: 48,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    color: colors.light.text,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  }
});
