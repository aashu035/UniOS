import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { AppCard } from './AppCard';
import { IconButton } from '../buttons/IconButton';
import { FileText, Video, Link as LinkIcon, Download, MoreVertical } from 'lucide-react-native';
import { colors, spacing, typography } from '../../tokens';

export type ResourceType = 'pdf' | 'video' | 'link';

interface ResourceCardProps {
  title: string;
  type: ResourceType;
  metadata: string;
  onPress?: () => void;
}

export function ResourceCard({ title, type, metadata, onPress }: ResourceCardProps) {
  const renderIcon = () => {
    switch (type) {
      case 'pdf':
        return <FileText size={24} color={colors.light.primary} />;
      case 'video':
        return <Video size={24} color={colors.light.warning} />;
      case 'link':
        return <LinkIcon size={24} color={colors.light.info} />;
    }
  };

  return (
    <AppCard style={styles.card} padding="none">
      <TouchableOpacity 
        style={styles.content}
        activeOpacity={0.7}
        onPress={onPress}
      >
        <View style={styles.iconContainer}>
          {renderIcon()}
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          <Text style={styles.metadata}>{metadata}</Text>
        </View>
        <View style={styles.actions}>
          {type === 'pdf' && (
            <IconButton icon={<Download size={20} color={colors.light.textMuted} />} variant="ghost" />
          )}
          <IconButton icon={<MoreVertical size={20} color={colors.light.textMuted} />} variant="ghost" />
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
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: colors.light.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
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
  metadata: {
    fontSize: typography.fontSize.xs,
    color: colors.light.textMuted,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  }
});
