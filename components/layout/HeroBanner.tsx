import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { HeroPortrait } from '../avatar/HeroPortrait';
import { colors, spacing, typography, radius } from '../../tokens';

interface HeroBannerProps {
  greeting?: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  showPortrait?: boolean;
  accent?: 'primary' | 'secondary' | 'neutral';
  rightElement?: React.ReactNode;
  children?: React.ReactNode; // For passing stats or extra actions at the bottom
}

export function HeroBanner({ 
  greeting, 
  title, 
  subtitle, 
  imageUrl, 
  showPortrait = false,
  accent = 'primary',
  rightElement,
  children
}: HeroBannerProps) {
  
  // Determine accent colors
  let backgroundColor = colors.light.surface;
  let textColor = colors.light.text;
  
  if (accent === 'primary') {
    backgroundColor = colors.light.primary;
    textColor = colors.dark.text; // Text on primary is light
  }

  return (
    <View style={[styles.container, { backgroundColor }]}>
      {/* Absolute top-right action area (e.g. notifications bell) */}
      {rightElement && (
        <View style={styles.topRightAction}>
          {rightElement}
        </View>
      )}

      <View style={styles.topRow}>
        <View style={styles.textColumn}>
          {greeting && (
            <Text style={[styles.greeting, { color: accent === 'primary' ? 'rgba(255,255,255,0.7)' : colors.light.textMuted }]}>
              {greeting}
            </Text>
          )}
          <Text style={[styles.title, { color: textColor }]}>{title}</Text>
          {subtitle && (
            <Text style={[styles.subtitle, { color: accent === 'primary' ? 'rgba(255,255,255,0.9)' : colors.light.text }]}>
              {subtitle}
            </Text>
          )}
        </View>
        
        {showPortrait && (
          <View style={styles.portraitColumn}>
            <HeroPortrait imageUrl={imageUrl} size={64} />
          </View>
        )}
      </View>
      
      {children && (
        <View style={styles.contentRow}>
          {children}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.xl,
    paddingTop: spacing['3xl'], // Extra padding for safe area / visual weight
    borderRadius: radius['3xl'],
    marginBottom: spacing.lg,
    position: 'relative',
  },
  topRightAction: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    zIndex: 10,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md, // Account for absolute right element
  },
  textColumn: {
    flex: 1,
    paddingRight: spacing.md,
  },
  portraitColumn: {
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  greeting: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: typography.fontSize['3xl'],
    fontWeight: typography.fontWeight.bold,
    letterSpacing: typography.letterSpacing.tight,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  contentRow: {
    marginTop: spacing.xl,
  }
});
