import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Icon, type IconName } from '../../components/uni/Icon';
import { Card, RoundButton, Screen, T, Tap } from '../../components/uni/primitives';
import { tint, useUni } from '../../components/uni/theme';
import { db } from '../../core/db/client';
import { exportAndShare, pickBackupText, restoreFromText } from '../../core/db/backupActions';
import { aiConnections, attendance, calendarEvents, faculty, resources, semesters, students, tasks, venues, workspaces } from '../../core/db/schema';

/**
 * More → Backup & export. One place to export, restore, and (behind a second
 * confirmation) clear everything. Previously this entry only offered "Clear".
 */
export default function BackupAndExport() {
  const p = useUni();
  const router = useRouter();
  const [busy, setBusy] = useState<'export' | 'import' | 'clear' | null>(null);
  const [clearArmed, setClearArmed] = useState(false);

  const doExport = async () => {
    setBusy('export');
    try {
      const r = await exportAndShare();
      if (r === 'saved') Alert.alert('Backup created', 'Sharing is not available on this device, so the backup was saved in the app cache.');
    } catch (e: any) {
      Alert.alert('Export failed', e?.message ?? 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const doImport = async () => {
    let text: string | null;
    try { text = await pickBackupText(); } catch (e: any) { Alert.alert('Could not open the file', e?.message ?? 'Please try again.'); return; }
    if (!text) return;
    Alert.alert('Replace everything with this backup?', 'Your current courses, attendance and tasks on this phone will be replaced by the backup. Export first if you want to keep them.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Restore', style: 'destructive', onPress: async () => {
          setBusy('import');
          try {
            await restoreFromText(text!);
            Alert.alert('Restored', 'Your backup is back on this phone.', [{ text: 'OK', onPress: () => router.replace('/') }]);
          } catch (e: any) {
            Alert.alert("That file isn't a UniOS backup", e?.message ?? 'Pick the .json file you exported from UniOS.');
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  };

  const doClear = async () => {
    if (!clearArmed) { setClearArmed(true); return; }
    setBusy('clear');
    try {
      for (const t of [tasks, resources, attendance, calendarEvents, workspaces, semesters, aiConnections, students, faculty, venues]) await db.delete(t);
      router.replace('/');
    } catch (e: any) {
      Alert.alert('Could not clear data', e?.message ?? 'Please try again.');
      setBusy(null);
    }
  };

  const row = (icon: IconName, title: string, body: string, onPress: () => void, kind: 'export' | 'import', color = p.primary) => (
    <Tap onPress={onPress} disabled={!!busy} accessibilityRole="button" style={[styles.row, { backgroundColor: p.elev, borderColor: p.hair }]}>
      <View style={[styles.well, { backgroundColor: tint(color, 12) }]}><Icon name={icon} size={20} color={color} /></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <T w={800} size={15}>{title}</T>
        <T c={p.muted} size={12.5} style={{ lineHeight: 17, marginTop: 2 }}>{body}</T>
      </View>
      {busy === kind ? <ActivityIndicator color={color} /> : <Icon name="chevron-right" size={18} color={p.muted} />}
    </Tap>
  );

  return (
    <Screen tabs={false}>
      <View style={styles.top}>
        <RoundButton icon="chevron-left" label="Back" onPress={() => router.back()} />
        <T w={800} size={17}>Backup & export</T>
        <View style={{ width: 44 }} />
      </View>
      <View style={{ paddingHorizontal: 20, gap: 12, marginTop: 8 }}>
        <T c={p.muted} size={13} style={{ lineHeight: 19 }}>
          Everything is stored only on this phone. Uninstalling the app or switching phones deletes it, so export a backup now and then (WhatsApp it to yourself or save it to Drive).
        </T>
        {row('upload', 'Export a backup', 'Courses, timetable, attendance, tasks and notes as one file.', doExport, 'export')}
        {row('hard-drive-download', 'Restore from a backup', 'Pick a UniOS backup file. It replaces what is on this phone.', doImport, 'import', p.warn)}
        <Card flat style={{ padding: 12 }}>
          <T c={p.muted} size={12} style={{ lineHeight: 17 }}>
            Attached files (PDFs, photos, videos) stay on this phone; the backup keeps their names, not the files.
          </T>
        </Card>
        <View style={[styles.danger, { backgroundColor: tint(p.danger, 6), borderColor: tint(p.danger, 25) }]}>
          <T w={800} size={14} c={p.danger}>Clear all data</T>
          <T c={p.muted} size={12.5} style={{ lineHeight: 17 }}>Deletes your profile, courses, attendance, tasks and files from this phone. This can't be undone.</T>
          <Tap onPress={doClear} disabled={busy === 'clear'} accessibilityRole="button" style={[styles.del, { borderColor: p.danger, backgroundColor: clearArmed ? p.danger : 'transparent' }]}>
            <T w={700} size={14} c={clearArmed ? '#fff' : p.danger}>{busy === 'clear' ? 'Clearing…' : clearArmed ? 'Tap again to delete everything' : 'Clear all data'}</T>
          </Tap>
          {clearArmed ? (
            <Tap onPress={() => setClearArmed(false)}><T w={700} size={13} c={p.muted} style={{ textAlign: 'center' }}>Keep my data</T></Tap>
          ) : null}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 20, borderWidth: 1 },
  well: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  danger: { marginTop: 10, padding: 14, borderRadius: 20, borderWidth: 1, gap: 10 },
  del: { height: 46, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
