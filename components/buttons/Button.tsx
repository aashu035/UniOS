import React from 'react';
import { TouchableOpacity, Text, StyleSheet, TouchableOpacityProps, ActivityIndicator } from 'react-native';
import { colors, radius, spacing, typography, opacity } from '../../tokens';
import * as Haptics from 'expo-haptics';

export type ButtonVariant = 'primary' | 'secondary' | 'text' | 'icon';

export interface ButtonProps extends TouchableOpacityProps {
  label?: string;
  variant?: ButtonVariant;
  loading?: boolean;
  icon?: React.ReactNode;
}

export function Button({ label, variant = 'primary', loading, disabled, style, icon, onPress, ...props }: ButtonProps) {
  const handlePress = (e: any) => {
    if (variant === 'primary') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (onPress) onPress(e);
  };

  return (
    <TouchableOpacity 
      style={[
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'text' && styles.text,
        variant === 'icon' && styles.icon,
        (disabled || loading) && { opacity: opacity.medium },
        style
      ]} 
      disabled={disabled || loading}
      activeOpacity={0.8}
      onPress={handlePress}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.dark.text : colors.light.primary} />
      ) : (
        <>
          {icon}
          {label && (
            <Text style={[
              styles.labelBase,
              variant === 'primary' && styles.labelPrimary,
              variant === 'secondary' && styles.labelSecondary,
              variant === 'text' && styles.labelText,
              (icon && label) ? { marginLeft: spacing.xs } : undefined
            ]}>
              {label}
            </Text>
          )}
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  primary: {
    backgroundColor: colors.light.primary,
    borderRadius: radius.full,
    paddingVertical: 12,
    paddingHorizontal: spacing.xl,
    minHeight: 48,
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.light.primary,
    borderRadius: radius.full,
    paddingVertical: 12,
    paddingHorizontal: spacing.xl,
    minHeight: 48,
  },
  text: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    minHeight: 40,
  },
  icon: {
    padding: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  labelBase: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  labelPrimary: {
    color: colors.dark.text,
  },
  labelSecondary: {
    color: colors.light.primary,
  },
  labelText: {
    color: colors.light.primary,
  }
});
