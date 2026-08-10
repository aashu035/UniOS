import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { AppCard } from './AppCard';
import { IconButton } from '../buttons/IconButton';
import { FileText, Video, Link as LinkIcon, Download, MoreVertical, AlignLeft } from 'lucide-react-native';
import { colors, spacing, typography } from '../../tokens';

export type ResourceType = 'pdf' | 'video' | 'link' | 'note' | string;

interface ResourceCardProps {
  title: string;
  type: ResourceType;
  metadata: string;
  thumbnailUrl?: string | null;
  onPress?: () => void;
  onDownload?: () => void;
  onMorePress?: () => void;
}

export function ResourceCard({ title, type, metadata, thumbnailUrl, onPress, onDownload, onMorePress }: ResourceCardProps) {
  const renderIcon = () => {
    switch (type) {
      case 'pdf':
      case 'document':
        return <FileText size={24} color={colors.light.primary} />;
      case 'video':
        return <Video size={24} color={colors.light.warning} />;
      case 'link':
        return <LinkIcon size={24} color="#3b82f6" />;
      case 'note':
        return <AlignLeft size={24} color={colors.light.primary} />;
      default:
        return <FileText size={24} color={colors.light.textMuted} />;
    }
  };

  const content = (
    <AppCard style={styles.card} padding="none">
      <View style={styles.content}>
        {thumbnailUrl ? (
          <Image source={{ uri: thumbnailUrl }} style={styles.thumbnail} />
        ) : (
          <View style={styles.iconContainer}>
            {renderIcon()}
          </View>
        )}
        <View style={styles.textContainer}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          <Text style={styles.metadata}>{metadata}</Text>
        </View>
        <View style={styles.actions}>
          {(type === 'pdf' || type === 'document') && onDownload && (
            <IconButton icon={<Download size={20} color={colors.light.textMuted} />} variant="ghost" onPress={onDownload} accessibilityLabel="Download resource" />
          )}
          {onMorePress && <IconButton icon={<MoreVertical size={20} color={colors.light.textMuted} />} variant="ghost" onPress={onMorePress} accessibilityLabel="Resource options" />}
        </View>
      </View>
    </AppCard>
  );

  return onPress ? <TouchableOpacity activeOpacity={0.7} onPress={onPress}>{content}</TouchableOpacity> : content;
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
  thumbnail: {
    width: 48,
    height: 48,
    borderRadius: 8,
    marginRight: spacing.md,
    backgroundColor: colors.light.surface,
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
