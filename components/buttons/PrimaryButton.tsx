import React from 'react';
import { TouchableOpacity, Text, StyleSheet, TouchableOpacityProps, ActivityIndicator, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../tokens';

interface PrimaryButtonProps extends TouchableOpacityProps {
  label: string;
  loading?: boolean;
}

export function PrimaryButton({ label, loading, disabled, style, ...props }: PrimaryButtonProps) {
  const isInactive = disabled || loading;
  return (
    <TouchableOpacity
      style={[
        styles.button,
        isInactive && styles.disabled,
        style,
      ]}
      disabled={isInactive}
      activeOpacity={0.82}
      {...props}
    >
      {/* Catch-light sheen along the top edge for a metallic feel */}
      <View style={styles.sheen} pointerEvents="none" />
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
    minHeight: 50,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.35)',
    shadowColor: colors.light.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 5,
  },
  sheen: {
    position: 'absolute',
    top: 1,
    left: 8,
    right: 8,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderTopLeftRadius: radius.full,
    borderTopRightRadius: radius.full,
  },
  disabled: {
    opacity: 0.5,
    shadowOpacity: 0,
    elevation: 0,
  },
  label: {
    color: colors.dark.text,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    letterSpacing: 0.2,
  },
});
