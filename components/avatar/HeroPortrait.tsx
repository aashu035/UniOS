import React from 'react';
import { View, StyleSheet, Image, ImageSourcePropType, TouchableOpacity } from 'react-native';
import { Camera } from 'lucide-react-native';
import { colors, elevation } from '../../tokens';

interface HeroPortraitProps {
  imageUrl?: string | ImageSourcePropType;
  onPress?: () => void;
  size?: number;
}

export function HeroPortrait({ imageUrl, onPress, size = 120 }: HeroPortraitProps) {
  const containerStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
  };

  const content = (
    <View style={[styles.container, containerStyle]}>
      {imageUrl ? (
        <Image 
          source={typeof imageUrl === 'string' ? { uri: imageUrl } : imageUrl} 
          style={styles.image} 
        />
      ) : (
        <View style={styles.placeholder}>
          {/* Abstract geometric placeholder per guidelines */}
          <View style={styles.abstractShape1} />
          <View style={styles.abstractShape2} />
        </View>
      )}
      
      {onPress && (
        <View style={styles.editBadge}>
          <Camera size={14} color={colors.dark.text} />
        </View>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.8} onPress={onPress}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  container: {
    ...elevation.md,
    backgroundColor: colors.light.surfaceElevated,
    position: 'relative',
    overflow: 'visible', // For the edit badge
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
  },
  placeholder: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.light.surface,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  abstractShape1: {
    position: 'absolute',
    width: '120%',
    height: '120%',
    backgroundColor: `${colors.light.primary}20`,
    borderRadius: 999,
    transform: [{ translateX: -20 }, { translateY: 20 }],
  },
  abstractShape2: {
    position: 'absolute',
    width: '80%',
    height: '80%',
    backgroundColor: `${colors.light.primary}40`,
    borderRadius: 999,
    transform: [{ translateX: 20 }, { translateY: -20 }],
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.light.primary,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.light.background,
  }
});
