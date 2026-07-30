import React, { useEffect, useRef } from 'react';
import { Animated, ViewStyle } from 'react-native';

interface ScaleInProps {
  children: React.ReactNode;
  duration?: number;
  delay?: number;
  initialScale?: number;
  style?: ViewStyle | ViewStyle[];
}

export function ScaleIn({ children, duration = 400, delay = 0, initialScale = 0.9, style }: ScaleInProps) {
  const scale = useRef(new Animated.Value(initialScale)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: duration * 0.8, // Opacity finishes slightly faster than scale
        delay,
        useNativeDriver: true,
      })
    ]).start();
  }, [scale, opacity, duration, delay]);

  return (
    <Animated.View style={[{ opacity, transform: [{ scale }] }, style]}>
      {children}
    </Animated.View>
  );
}
