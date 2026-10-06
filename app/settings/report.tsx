import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Share, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Icon } from '../../components/uni/Icon';
import { Card, RoundButton, Screen, T, Tap } from '../../components/uni/primitives';
import { mono, sans, useUni } from '../../components/uni/theme';
import { buildReport, sendReport } from '../../core/diagnostics';

/**
 * Report a problem. "Send" goes to Sentry with app details attached; "Share"
 * hands the same text to any app (WhatsApp, Claude, ChatGPT) for help.
 * Only counts are included, never course names, notes or files.
 */
export default function ReportProblem() {
  const p = useUni();
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const [note, setNote] = useState('');
  const [email, setEmail] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { buildReport(note, from).then(setPreview).catch(() => setPreview(null)); }, [showPreview]);

  const send = async () => {
    if (!note.trim()) { Alert.alert('Describe the problem', 'A sentence or two about what you did and what went wrong helps a lot.'); return; }
    setBusy(true);
    try {
      const id = await sendReport(note, email, from);
      Alert.alert('Report sent', `Thanks. Reference: ${id.slice(0, 8)}`, [{ text: 'Done', onPress: () => router.back() }]);
    } catch {
      Alert.alert('Could not send', 'Check your internet connection, or use Share instead.');
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    try { await Share.share({ message: await buildReport(note, from) }); } catch { /* user closed the share sheet */ }
  };

  const field = [styles.input, sans(500), { backgroundColor: p.elev, borderColor: p.hair, color: p.text }];

  return (
    <Screen tabs={false}>
      <View style={styles.top}>
        <RoundButton icon="chevron-left" label="Back" onPress={() => router.back()} />
        <T w={800} size={17}>Report a problem</T>
        <View style={{ width: 44 }} />
      </View>

      <View style={{ paddingHorizontal: 20, gap: 12, marginTop: 8 }}>
        <T c={p.muted} size={13} style={{ lineHeight: 19 }}>
          Say what you tapped and what happened instead. App version, phone model, data counts and recent error messages are attached. Your notes and files are not; an error message can occasionally mention a course name. Tap below to see exactly what's sent.
        </T>
        <TextInput
          value={note} onChangeText={setNote} multiline textAlignVertical="top"
          placeholder="e.g. I marked OS absent on Tuesday and the percentage didn't change"
          placeholderTextColor={p.muted} style={[...field, { minHeight: 120, paddingTop: 12 }]} accessibilityLabel="What went wrong"
        />
        <TextInput
          value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
          placeholder="Email for a reply (optional)" placeholderTextColor={p.muted} style={[...field, { height: 48 }]} accessibilityLabel="Email"
        />

        <Tap onPress={send} disabled={busy} accessibilityRole="button" style={[styles.cta, { backgroundColor: p.primary, opacity: busy ? 0.7 : 1 }]}>
          {busy ? <ActivityIndicator color="#fff" /> : <Icon name="upload" size={18} color="#fff" />}
          <T w={800} c="#fff" size={15}>Send report</T>
        </Tap>
        <Tap onPress={share} accessibilityRole="button" style={[styles.cta, { backgroundColor: p.surface }]}>
          <Icon name="arrow-right" size={18} color={p.text} />
          <T w={700} size={15}>Share details to another app</T>
        </Tap>
        <T c={p.muted} size={12} style={{ textAlign: 'center' }}>Share works offline. Paste it into Claude or ChatGPT to ask for help.</T>

        <Tap onPress={() => setShowPreview((v) => !v)} style={styles.previewToggle}>
          <T w={700} c={p.muted} size={13}>{showPreview ? 'Hide' : 'Show'} what gets attached</T>
          <Icon name="chevron-right" size={16} color={p.muted} />
        </Tap>
        {showPreview ? (
          <Card flat style={{ padding: 12 }}>
            <T style={[mono(), { fontSize: 11, lineHeight: 16 }]} selectable>{preview ?? 'Loading…'}</T>
          </Card>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8 },
  input: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, fontSize: 14.5 },
  cta: { height: 52, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  previewToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
});
