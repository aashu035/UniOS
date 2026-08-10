import React, { useState } from 'react';
import { View, StyleSheet, Image, ImageSourcePropType, TouchableOpacity } from 'react-native';
import { Camera } from 'lucide-react-native';
import { colors, elevation } from '../../tokens';

interface HeroPortraitProps {
  imageUrl?: string | ImageSourcePropType | null;
  onPress?: () => void;
  size?: number;
}

export function HeroPortrait({ imageUrl, onPress, size = 120 }: HeroPortraitProps) {
  const [imageError, setImageError] = useState(false);
  
  const containerStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
  };

  const hasImage = !!imageUrl && !imageError;

  const content = (
    <View style={[styles.container, containerStyle]}>
      {hasImage ? (
        <Image 
          source={typeof imageUrl === 'string' ? { uri: imageUrl } : imageUrl as ImageSourcePropType} 
          style={styles.image}
          onError={() => setImageError(true)}
        />
      ) : (
        <View style={styles.placeholder}>
          {/* Abstract geometric placeholder */}
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
    overflow: 'visible',
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
    position: 'relative',
  },
  abstractShape1: {
    position: 'absolute',
    top: '-10%',
    left: '-20%',
    width: '120%',
    height: '120%',
    backgroundColor: `${colors.light.primary}20`,
    borderRadius: 999,
  },
  abstractShape2: {
    position: 'absolute',
    bottom: '-10%',
    right: '-20%',
    width: '80%',
    height: '80%',
    backgroundColor: `${colors.light.primary}40`,
    borderRadius: 999,
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
