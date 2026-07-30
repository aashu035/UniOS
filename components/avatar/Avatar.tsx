import React from 'react';
import { View, Text, StyleSheet, Image, ImageSourcePropType, ViewStyle } from 'react-native';
import { colors, typography } from '../../tokens';

interface AvatarProps {
  name: string;
  imageUrl?: string | ImageSourcePropType;
  size?: number;
  style?: ViewStyle;
}

export function Avatar({ name, imageUrl, size = 40, style }: AvatarProps) {
  const initials = name
    .split(' ')
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  const containerStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
  };

  if (imageUrl) {
    const source = typeof imageUrl === 'string' ? { uri: imageUrl } : imageUrl;
    return <Image source={source as any} style={[styles.container, containerStyle, style]} />;
  }

  return (
    <View style={[styles.container, styles.placeholder, containerStyle, style]}>
      <Text style={[styles.text, { fontSize: size * 0.4 }]}>{initials || '?'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: colors.light.surfaceElevated,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.light.primary,
  },
  text: {
    color: colors.dark.text,
    fontWeight: typography.fontWeight.bold,
  }
});
