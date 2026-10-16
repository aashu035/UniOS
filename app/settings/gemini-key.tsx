import React, { useEffect, useRef, useState } from 'react';
import { Linking, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Icon, type IconName } from '../../components/uni/Icon';
import { T, Tap } from '../../components/uni/primitives';
import { FieldLabel, FormPage, PrimaryButton } from '../../components/uni/form';
import { useToast } from '../../components/uni/Toast';
import { mono, tint, useUni } from '../../components/uni/theme';
import { testGeminiKey } from '../../core/ai/timetableParser';
import { GeminiKey } from '../../core/settings/aiProviders';
import { Clipboard } from '../../core/utils/clipboard';
import { isGeminiKey, maskKey, scanErrorKind } from '../../domains/timetable/scan';

type Check = 'idle' | 'format' | 'testing' | 'rejected' | 'offline' | 'other';

const STEPS = [
  'Open AI Studio and sign in with your Google account.',
  'Tap Get API key, then Create API key.',
  'Copy the key and paste it below. It starts with AIza.',
];

/**
 * Gemini key (design UniScan, handoff §8). The key is checked for its shape
 * first, then with one `models.list` call, and saved with expo-secure-store
 * only when Google accepts it. It never goes into backups or logs.
 */
export default function GeminiKeyScreen() {
  const p = useUni();
  const router = useRouter();
  const toast = useToast();
  const [saved, setSaved] = useState<string | null>(null);
  const [tested, setTested] = useState(false);
  const [form, setForm] = useState(false);
  const [key, setKey] = useState('');
  const [show, setShow] = useState(false);
  const [check, setCheck] = useState<Check>('idle');
  const [armed, setArmed] = useState(false);
  const armTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    GeminiKey.get().then((k) => { setSaved(k); setForm(!k); }).catch(() => setForm(true));
    return () => { if (armTimer.current) clearTimeout(armTimer.current); };
  }, []);

  const k = key.trim();
  const test = async () => {
    if (!isGeminiKey(k)) return setCheck('format');
    setCheck('testing');
    try {
      await testGeminiKey(k);
    } catch (e) {
      const kind = scanErrorKind(e);
      // A rate limit means Google knows the key, so it works.
      if (kind !== 'limit-day' && kind !== 'limit-minute') {
        return setCheck(kind === 'rejected' ? 'rejected' : kind === 'offline' ? 'offline' : 'other');
      }
    }
    try {
      await GeminiKey.save(k);
    } catch (e) {
      console.error('Could not save the Gemini key', e instanceof Error ? e.message : e);
      return setCheck('other');
    }
    setSaved(k); setTested(true); setForm(false); setKey(''); setCheck('idle'); setShow(false);
    toast.show('Key saved on this phone.');
  };

  const remove = async () => {
    if (!armed) {
      setArmed(true);
      armTimer.current = setTimeout(() => setArmed(false), 3000);
      return;
    }
    if (armTimer.current) clearTimeout(armTimer.current);
    setArmed(false);
    await GeminiKey.save(null);
    setSaved(null); setTested(false); setForm(true);
    toast.show('Key removed from this phone.');
  };

  const paste = async () => { const s = (await Clipboard.getString()).trim(); if (s) { setKey(s.slice(0, 80)); setCheck('idle'); } };

  const MSG: Partial<Record<Check, [IconName, string, string]>> = {
    format: ['circle-alert', p.danger, 'Gemini keys start with AIza and are 39 characters long. Check you copied all of it.'],
    rejected: ['shield-x', p.danger, 'Google rejected this key. It may have been deleted, or a character is missing.'],
    offline: ['wifi-off', p.warn, 'You’re offline. Connect to the internet to test the key.'],
    other: ['circle-alert', p.danger, 'Couldn’t check the key right now. Try again in a minute.'],
  };
  const msg = MSG[check];
  const footer = form
    ? <PrimaryButton label={check === 'testing' ? 'Testing…' : 'Test and save'} onPress={test} busy={false} disabled={!k || check === 'testing'} />
    : <PrimaryButton label="Done" onPress={() => router.back()} />;

  return (
    <FormPage title="Gemini key" backIcon="chevron-left" onBack={() => router.back()} gap={14} footer={footer}>
      <View style={{ padding: 16, borderRadius: 20, backgroundColor: p.elev, borderWidth: 1, borderColor: p.hair, gap: 8 }}>
        <T w={800} size={15}>What's this key?</T>
        <T c={p.muted} size={13.5} style={{ lineHeight: 20 }}>
          A Gemini API key lets UniOS ask Google's Gemini to read a timetable photo. The free tier is enough for scanning. The key stays on this phone and isn't included in backups.
        </T>
      </View>

      {saved && !form ? (
        <View style={{ gap: 10, padding: 14, borderRadius: 18, backgroundColor: tint(p.success, 10) }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Icon name="circle-check" size={20} color={p.success} />
            <View style={{ flex: 1 }}>
              <T w={800} size={14.5}>{tested ? 'Key works · saved on this phone' : 'Key saved on this phone'}</T>
              <T c={p.muted} size={12.5} style={[mono(500), { marginTop: 2 }]} accessibilityLabel="Key, hidden">{maskKey(saved)}</T>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Tap onPress={() => { setForm(true); setCheck('idle'); }} accessibilityRole="button"
              style={{ flex: 1, height: 44, borderRadius: 12, backgroundColor: p.elev, alignItems: 'center', justifyContent: 'center' }}>
              <T w={800} size={13.5}>Replace key</T>
            </Tap>
            <Tap onPress={remove} accessibilityRole="button" accessibilityLabel={armed ? 'Tap again to remove the key' : 'Remove key'}
              style={{ flex: 1, height: 44, borderRadius: 12, backgroundColor: armed ? p.danger : p.elev, alignItems: 'center', justifyContent: 'center' }}>
              <T w={800} size={13.5} c={armed ? '#fff' : p.danger}>{armed ? 'Tap again to remove' : 'Remove key'}</T>
            </Tap>
          </View>
        </View>
      ) : null}

      {form ? (
        <>
          <View style={{ gap: 10 }}>
            <FieldLabel>Get a free key at aistudio.google.com</FieldLabel>
            {STEPS.map((s, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: p.surface, alignItems: 'center', justifyContent: 'center' }}>
                  <T w={800} size={12} style={mono(700)}>{i + 1}</T>
                </View>
                <T w={600} size={13.5} style={{ flex: 1, lineHeight: 20, paddingTop: 3 }}>{s}</T>
              </View>
            ))}
            <Tap onPress={() => Linking.openURL('https://aistudio.google.com/apikey').catch(() => toast.show('Couldn’t open the browser.'))} accessibilityRole="link"
              style={{ alignSelf: 'flex-start', height: 44, paddingHorizontal: 14, borderRadius: 13, backgroundColor: p.surface, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon name="external-link" size={15} color={p.text} />
              <T w={800} size={13.5}>Open AI Studio</T>
            </Tap>
          </View>

          <View style={{ gap: 6 }}>
            <FieldLabel>Your key</FieldLabel>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 52, paddingLeft: 13, paddingRight: 4, borderRadius: 14, borderWidth: 1.5, borderColor: msg ? msg[1] : p.border, backgroundColor: p.elev }}>
              <TextInput value={key} onChangeText={(v) => { setKey(v.slice(0, 80)); setCheck('idle'); }} placeholder="AIza…" placeholderTextColor={p.muted}
                secureTextEntry={!show} autoCapitalize="none" autoCorrect={false} autoComplete="off" importantForAutofill="no" spellCheck={false}
                accessibilityLabel="Gemini API key" onSubmitEditing={test}
                style={[mono(500), { flex: 1, minWidth: 0, fontSize: 14, color: p.text, paddingVertical: 0 }]} />
              <Tap onPress={() => setShow(!show)} accessibilityRole="button" accessibilityLabel={show ? 'Hide key' : 'Show key'}
                style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={show ? 'eye-off' : 'eye'} size={18} color={p.muted} />
              </Tap>
              {Clipboard.available() ? (
                <Tap onPress={paste} accessibilityRole="button" style={{ height: 40, paddingHorizontal: 12, borderRadius: 10, backgroundColor: p.surface, justifyContent: 'center' }}>
                  <T w={800} size={13}>Paste</T>
                </Tap>
              ) : null}
            </View>
            {msg ? (
              <View style={{ flexDirection: 'row', gap: 8, padding: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: tint(msg[1], 10) }} accessibilityLiveRegion="polite">
                <Icon name={msg[0]} size={15} color={msg[1]} />
                <T w={700} size={12.5} style={{ flex: 1, lineHeight: 18 }}>{msg[2]}</T>
              </View>
            ) : null}
            {saved ? (
              <Tap onPress={() => { setForm(false); setKey(''); setCheck('idle'); }} accessibilityRole="button" style={{ alignSelf: 'flex-start', height: 44, justifyContent: 'center' }}>
                <T w={800} c={p.primary} size={13.5}>Keep the saved key</T>
              </Tap>
            ) : null}
          </View>
        </>
      ) : null}
    </FormPage>
  );
}
