import React from 'react';
import { TouchableOpacity, Text, StyleSheet, TouchableOpacityProps, ActivityIndicator } from 'react-native';
import { colors, spacing, typography } from '../../tokens';

interface TextButtonProps extends TouchableOpacityProps {
  label: string;
  loading?: boolean;
}

export function TextButton({ label, loading, disabled, style, ...props }: TextButtonProps) {
  return (
    <TouchableOpacity 
      style={[
        styles.button,
        (disabled || loading) && styles.disabled,
        style
      ]} 
      disabled={disabled || loading}
      activeOpacity={0.6}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={colors.light.primary} size="small" />
      ) : (
        <Text style={styles.label}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    color: colors.light.primary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  }
});
