import React from 'react';
import { TouchableOpacity, StyleSheet, TouchableOpacityProps } from 'react-native';
import { colors, radius, spacing } from '../../tokens';

interface IconButtonProps extends TouchableOpacityProps {
  icon: React.ReactNode;
  variant?: 'ghost' | 'filled' | 'outlined';
}

export function IconButton({ icon, variant = 'ghost', disabled, style, ...props }: IconButtonProps) {
  return (
    <TouchableOpacity 
      style={[
        styles.button,
        styles[variant],
        disabled && styles.disabled,
        style
      ]} 
      disabled={disabled}
      activeOpacity={0.7}
      {...props}
    >
      {icon}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    width: 40,
    height: 40,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  filled: {
    backgroundColor: colors.light.surfaceElevated,
  },
  outlined: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  disabled: {
    opacity: 0.5,
  },
});
