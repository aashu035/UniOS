import React from 'react';
import { View } from 'react-native';
import { Icon, type IconName } from '../uni/Icon';
import { T } from '../uni/primitives';
import { PrimaryButton } from '../uni/form';
import { tint, useUni } from '../uni/theme';
import { fileVisual } from '../uni/fileKinds';

/** The four shared states of the viewer (handoff §2): loading, missing, can't open, no app. */
export type StateKind = 'missing' | 'cantopen' | 'noapp';

export function Loading({ ext, dark }: { ext: string; dark?: boolean }) {
  const p = useUni();
  const v = fileVisual({ type: 'file', uri: `x.${ext}` });
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 }} accessibilityLiveRegion="polite" accessibilityLabel="Opening">
      <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: tint(v.color, 14), alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={v.icon} size={28} color={v.color} />
      </View>
      <T w={700} size={14} c={dark ? '#fff' : p.muted}>Opening…</T>
      <View style={{ alignSelf: 'stretch', paddingHorizontal: 28, gap: 10 }}>
        {[0.9, 0.7, 0.8].map((w, i) => <View key={i} style={{ height: 12, width: `${w * 100}%`, borderRadius: 6, backgroundColor: dark ? 'rgba(255,255,255,0.12)' : p.surface }} />)}
      </View>
    </View>
  );
}

export function StateCard({ kind, name, ext, appName, onPrimary, onSecondary, detail }: {
  kind: StateKind; name: string; ext: string; appName?: string | null; detail?: string;
  onPrimary: () => void; onSecondary: () => void;
}) {
  const p = useUni();
  const S: Record<StateKind, { icon: IconName; c: string; t: string; d: string; a: [string, string] }> = {
    missing: {
      icon: 'hard-drive', c: p.warn, t: 'This file isn’t on this phone',
      d: 'UniOS still has it in your list, but the file itself is gone. This can happen after restoring a backup, which keeps your list and not the files.',
      a: ['Add it again', 'Remove from list'],
    },
    cantopen: {
      icon: 'x', c: p.danger, t: 'Can’t open this file',
      d: detail || `UniOS can’t show .${ext.toUpperCase()} files. Another app can.`,
      a: ['Open in another app', 'Share'],
    },
    noapp: {
      icon: 'search-x', c: p.muted, t: 'No app on this phone can open it',
      d: `.${ext.toUpperCase()} files need an app that can read them.${appName ? ` ${appName} is free and opens them.` : ''}`,
      a: [appName ? `Get ${appName}` : 'Share', 'Share'],
    },
  };
  const s = S[kind];
  return (
    <View style={{ flex: 1, padding: 20, justifyContent: 'center', gap: 12 }}>
      <View style={{ paddingVertical: 24, paddingHorizontal: 18, borderRadius: 24, backgroundColor: p.elev, borderWidth: 1, borderColor: p.hair, alignItems: 'center', gap: 12 }} accessibilityLiveRegion="polite">
        <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: tint(s.c, 13), alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={s.icon} size={26} color={s.c} />
        </View>
        <T w={800} size={18} style={{ textAlign: 'center', lineHeight: 24 }} accessibilityRole="header">{s.t}</T>
        <T c={p.muted} size={13.5} style={{ textAlign: 'center', lineHeight: 20 }}>{s.d}</T>
        <T w={600} c={p.muted} size={12} numberOfLines={2} style={{ textAlign: 'center' }}>{name}</T>
      </View>
      <PrimaryButton label={s.a[0]} onPress={onPrimary} />
      {kind === 'noapp' && !appName ? null : <PrimaryButton label={s.a[1]} tone="plain" onPress={onSecondary} />}
    </View>
  );
}
