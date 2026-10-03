import React, { useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, View } from 'react-native';
import { Icon, type IconName } from './Icon';
import { T } from './primitives';
import { shadow, useUni } from './theme';

export interface DeckCard { key: string; color: string; tint: string; icon: IconName; eyebrow: string; cta: string; title: string; body: string }

/**
 * Home's alert stack: swipe the top card sideways for the next one, tap to open.
 * Mirrors the deck in UniHome.dc.html (fly-out past 80 px, cards behind rise in).
 */
export function AlertDeck({ cards, onOpen }: { cards: DeckCard[]; onOpen: (i: number) => void }) {
  const p = useUni();
  const [top, setTop] = useState(0);
  const dx = useRef(new Animated.Value(0)).current;
  const dy = useRef(new Animated.Value(0)).current;
  const n = cards.length;
  const state = useRef({ top: 0, n: 0, onOpen });
  state.current = { top, n, onOpen };

  const advance = (dir: number) => {
    Animated.timing(dx, { toValue: dir * 460, duration: 240, useNativeDriver: true }).start(() => {
      setTop((t) => (t + 1) % Math.max(1, state.current.n));
      dx.setValue(0); dy.setValue(0);
    });
  };

  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy),
    onPanResponderTerminationRequest: () => false,
    onPanResponderMove: (_, g) => { dx.setValue(g.dx); dy.setValue(g.dy * 0.25); },
    onPanResponderRelease: (_, g) => {
      if (Math.abs(g.dx) < 6 && Math.abs(g.dy) < 6) { state.current.onOpen(state.current.top); return; }
      if (Math.abs(g.dx) > 80 && state.current.n > 1) advance(Math.sign(g.dx));
      else Animated.spring(dx, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start(() => dy.setValue(0));
      Animated.spring(dy, { toValue: 0, useNativeDriver: true }).start();
    },
    onPanResponderTerminate: () => { Animated.spring(dx, { toValue: 0, useNativeDriver: true }).start(); dy.setValue(0); },
  }), []);

  const prog = dx.interpolate({ inputRange: [-220, 0, 220], outputRange: [1, 0, 1], extrapolate: 'clamp' });
  const visible = Math.min(3, n);

  return (
    <View>
      <View style={{ height: 150, marginHorizontal: 20 }}>
        {Array.from({ length: visible }).map((_, k) => {
          const i = visible - 1 - k; // render back to front
          const card = cards[(top + i) % n];
          const pos = Animated.subtract(i, prog).interpolate({ inputRange: [0, 3], outputRange: [0, 3], extrapolateLeft: 'clamp' });
          const style = i === 0
            ? {
                transform: [{ translateX: dx }, { translateY: dy }, { rotate: dx.interpolate({ inputRange: [-220, 220], outputRange: ['-10deg', '10deg'] }) }],
                opacity: dx.interpolate({ inputRange: [-360, 0, 360], outputRange: [0.4, 1, 0.4], extrapolate: 'clamp' }),
              }
            : {
                transform: [
                  { translateY: Animated.multiply(pos, 10) },
                  { scale: Animated.subtract(1, Animated.multiply(pos, 0.05)) },
                ],
                opacity: Animated.subtract(1, Animated.multiply(pos, 0.28)),
              };
          return (
            <Animated.View key={card.key + i} {...(i === 0 ? pan.panHandlers : {})}
              accessible={i === 0} accessibilityRole="button" accessibilityLabel={`${card.eyebrow}. ${card.title}. ${card.body}`}
              accessibilityActions={n > 1 ? [{ name: 'activate' }, { name: 'increment', label: 'Next alert' }] : [{ name: 'activate' }]}
              onAccessibilityAction={(e) => (e.nativeEvent.actionName === 'increment' ? setTop((t) => (t + 1) % n) : onOpen(top))}
              style={[{
                position: 'absolute', left: 0, right: 0, top: 0, height: 132, padding: 16, borderRadius: 24, gap: 6, overflow: 'hidden',
                backgroundColor: p.elev, borderWidth: 1, borderColor: p.hair, zIndex: 3 - i, transformOrigin: 'top',
              }, shadow(p), style]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: card.tint, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={card.icon} size={16} color={card.color} width={2.2} />
                </View>
                <T w={700} c={card.color} size={11.5} style={{ letterSpacing: 0.4, textTransform: 'uppercase', flex: 1 }} numberOfLines={1}>{card.eyebrow}</T>
                <T w={600} c={p.muted} size={12}>{card.cta}</T>
              </View>
              <T w={700} size={17} style={{ letterSpacing: -0.2, lineHeight: 22 }} numberOfLines={1}>{card.title}</T>
              <T c={p.muted} size={13.5} style={{ lineHeight: 19 }} numberOfLines={2}>{card.body}</T>
            </Animated.View>
          );
        })}
      </View>
      {n > 1 && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 24, marginTop: -2 }}>
          {cards.map((c, i) => (
            <Pressable key={c.key} onPress={() => setTop(i)} hitSlop={6} accessibilityLabel={`Show alert ${i + 1}`}>
              <View style={{ height: 6, width: i === top ? 18 : 6, borderRadius: 3, backgroundColor: i === top ? p.primary : p.border }} />
            </Pressable>
          ))}
          <T w={500} c={p.muted} size={12} style={{ marginLeft: 8 }}>Swipe for next · tap to open</T>
        </View>
      )}
    </View>
  );
}
