import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AppCard } from './AppCard';
import { colors, spacing, typography } from '../../tokens';
import { Avatar } from '../avatar/Avatar';
import { Mail } from 'lucide-react-native';

export interface FacultyCardProps {
  name: string;
  title: string;
  email?: string;
  style?: any;
}

export function FacultyCard({ name, title, email, style }: FacultyCardProps) {
  return (
    <AppCard style={[styles.container, style]}>
      <Avatar fallback={name} size={48} />
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
    ...typography.h4,
    marginBottom: 2,
  },
  title: {
    ...typography.body,
    color: colors.light.textMuted,
    marginBottom: spacing.xs,
  },
  emailContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  email: {
    ...typography.caption,
    color: colors.light.textMuted,
  }
});
