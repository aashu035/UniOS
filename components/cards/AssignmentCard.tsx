import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { AppCard } from './AppCard';
import { IconButton } from '../buttons/IconButton';
import { CheckCircle2, Circle, Clock, FileText } from 'lucide-react-native';
import { colors, spacing, typography } from '../../tokens';

interface AssignmentCardProps {
  title: string;
  dueDate: string;
  isCompleted?: boolean;
  score?: string;
  onPress?: () => void;
}

export function AssignmentCard({ title, dueDate, isCompleted = false, score, onPress }: AssignmentCardProps) {
  return (
    <AppCard style={styles.card} padding="none">
      <TouchableOpacity 
        style={styles.content}
        activeOpacity={0.7}
        onPress={onPress}
      >
        <View style={styles.iconContainer}>
          {isCompleted ? (
            <CheckCircle2 size={24} color={colors.light.success} />
          ) : (
            <Circle size={24} color={colors.light.textMuted} />
          )}
        </View>
        <View style={styles.textContainer}>
          <Text style={[styles.title, isCompleted && styles.titleCompleted]} numberOfLines={1}>
            {title}
          </Text>
          <View style={styles.metaRow}>
            {score ? (
              <>
                <FileText size={12} color={colors.light.textMuted} />
                <Text style={styles.metadata}>Score: {score}</Text>
              </>
            ) : (
              <>
                <Clock size={12} color={isCompleted ? colors.light.textMuted : colors.light.warning} />
                <Text style={[styles.metadata, !isCompleted && styles.metadataUrgent]}>Due {dueDate}</Text>
              </>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  iconContainer: {
    marginRight: spacing.md,
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.light.text,
    marginBottom: 4,
  },
  titleCompleted: {
    color: colors.light.textMuted,
    textDecorationLine: 'line-through',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metadata: {
    fontSize: typography.fontSize.xs,
    color: colors.light.textMuted,
  },
  metadataUrgent: {
    color: colors.light.warning,
    fontWeight: typography.fontWeight.medium,
  }
});
