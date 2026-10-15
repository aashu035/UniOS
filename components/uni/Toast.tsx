import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSegments } from 'expo-router';
import { Icon } from './Icon';
import { T, Tap } from './primitives';
import { useUni } from './theme';

type ToastOpts = { undo?: () => void | Promise<void> };
type Shown = ToastOpts & { id: number; msg: string };

const Ctx = createContext<{ show: (msg: string, opts?: ToastOpts) => void }>({ show: () => {} });

/** `const toast = useToast(); toast.show('Saved', { undo })`. One toast at a time; the newest replaces the last. */
export const useToast = () => useContext(Ctx);

const SHOW_MS = 4500;

/**
 * The app-wide toast from the design: a dark bubble above the tab bar (or near the
 * bottom on full-screen pages), with an optional Undo. It lives at the root, so a
 * screen can show it and go back in the same tap.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const p = useUni();
  const insets = useSafeAreaInsets();
  const segments = useSegments();
  const [toast, setToast] = useState<Shown | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((msg: string, opts: ToastOpts = {}) => {
    if (timer.current) clearTimeout(timer.current);
    const id = Date.now() + Math.random();
    setToast({ id, msg, ...opts });
    timer.current = setTimeout(() => setToast((t) => (t?.id === id ? null : t)), SHOW_MS);
  }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const undo = () => {
    const u = toast?.undo;
    if (timer.current) clearTimeout(timer.current);
    setToast(null);
    Promise.resolve(u?.()).catch((e) => console.error('Undo failed', e));
  };

  const overTabs = segments[0] === '(main)';
  return (
    <Ctx.Provider value={{ show }}>
      {children}
      {toast ? (
        <Animated.View key={toast.id} entering={FadeInDown.duration(260)} exiting={FadeOutDown.duration(200)} pointerEvents="box-none"
          style={[styles.wrap, { bottom: insets.bottom + (overTabs ? 112 : 34) }]}>
          <View accessibilityLiveRegion="polite" style={[styles.toast, { backgroundColor: p.text }]}>
            <Icon name="circle-check" size={17} color={p.success} />
            <T w={600} c={p.bg} size={13} style={{ flex: 1, lineHeight: 18 }}>{toast.msg}</T>
            {toast.undo ? (
              <Tap onPress={undo} hitSlop={12} accessibilityRole="button" accessibilityLabel="Undo">
                <T w={800} c={p.dark ? '#1d61e7' : '#93B4F5'} size={13}>Undo</T>
              </Tap>
            ) : null}
          </View>
        </Animated.View>
      ) : null}
    </Ctx.Provider>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16 },
  toast: {
    minHeight: 48, paddingVertical: 13, paddingHorizontal: 14, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 10,
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 15, shadowOffset: { width: 0, height: 14 }, elevation: 8,
  },
});
