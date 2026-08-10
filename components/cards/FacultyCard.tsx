import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { AppCard } from './AppCard';
import { colors, spacing, typography } from '../../tokens';
import { Avatar } from '../avatar/Avatar';
import { Mail } from 'lucide-react-native';

export interface FacultyCardProps {
  name: string;
  title: string;
  email?: string;
  style?: StyleProp<ViewStyle>;
}

export function FacultyCard({ name, title, email, style }: FacultyCardProps) {
  return (
    <AppCard style={[styles.container, style]}>
      <Avatar name={name} size={48} />
      <View style={styles.content}>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.title}>{title}</Text>
        {email && (
          <View style={styles.emailContainer}>
            <Mail size={14} color={colors.light.textMuted} />
            <Text style={styles.email}>{email}</Text>
          </View>
        )}
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  content: {
    flex: 1,
  },
  name: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.light.text,
    marginBottom: 2,
  },
  title: {
    fontSize: typography.fontSize.sm,
    color: colors.light.textMuted,
    marginBottom: spacing.xs,
  },
  emailContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  email: {
    fontSize: typography.fontSize.xs,
    color: colors.light.textMuted,
  }
});
