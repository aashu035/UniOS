import React, { useCallback, useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { AppScaffold } from '../../components/layout/AppScaffold';
import { PageContainer } from '../../components/layout/PageContainer';
import { HeroBanner } from '../../components/layout/HeroBanner';
import { SectionHeader } from '../../components/layout/SectionHeader';
import { AppCard } from '../../components/cards/AppCard';
import { InfoRow } from '../../components/layout/InfoRow';
import { Divider } from '../../components/layout/Divider';
import { SecondaryButton } from '../../components/buttons/SecondaryButton';
import { IconButton } from '../../components/buttons/IconButton';
import { Skeleton } from '../../components/ui/Skeleton';
import { useProfile } from '../../domains/profile/hooks';
import { Settings, BookOpen, User, Hash } from 'lucide-react-native';
import { colors, spacing, radius } from '../../tokens';
import { useFocusEffect, useRouter } from 'expo-router';
import { expoDb } from '../../core/db/client';
import * as FileSystem from 'expo-file-system/legacy';
import { exportAndShare, pickBackupText, restoreFromText } from '../../core/db/backupActions';

export default function Profile() {
  const router = useRouter();
  const { profile, isLoading, refreshProfile } = useProfile();
  const [isExporting, setIsExporting] = useState(false);

  useFocusEffect(useCallback(() => {
    refreshProfile();
  }, [refreshProfile]));

  const [isImporting, setIsImporting] = useState(false);

  // Same actions as More → Backup & export (core/db/backupActions).
  const exportData = async () => {
    setIsExporting(true);
    try {
      const r = await exportAndShare();
      if (r === 'saved') Alert.alert('Backup created', 'Sharing is not available on this device.');
    } catch (error) {
      Alert.alert('Export failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const importData = async () => {
    let text: string | null = null;
    try { text = await pickBackupText(); } catch (error) { console.error('Could not pick file', error); }
    if (!text) return;
    Alert.alert('Restore backup?', 'This replaces all your current data with the backup. Export first if you want to keep it.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Restore', style: 'destructive', onPress: async () => {
          setIsImporting(true);
          try {
            await restoreFromText(text!);
            Alert.alert('Restored', 'Your data has been restored.');
            refreshProfile();
          } catch (error) {
            Alert.alert("That file isn't a UniOS backup", error instanceof Error ? error.message : 'Pick the file you exported from UniOS.');
          } finally {
            setIsImporting(false);
          }
        },
      },
    ]);
  };

  if (isLoading) {
    return (
      <AppScaffold>
        <View style={styles.loadingContainer}>
          <Skeleton height={200} borderRadius={radius.lg} />
        </View>
      </AppScaffold>
    );
  }

  // Fallback data
  const name = profile?.name || 'Student Name';
  const branch = profile?.branch || 'Not specified';
  const enrollment = profile?.enrollmentNo || 'Not specified';
  const semester = profile?.currentSemester ? `Semester ${profile.currentSemester}` : 'Not specified';
  const docDir = FileSystem.documentDirectory ? FileSystem.documentDirectory.replace(/\/$/, '') : '';
  const displayAvatar = profile?.avatar 
    ? (profile.avatar.startsWith('http') || profile.avatar.startsWith('file://') ? profile.avatar : `${docDir}/${profile.avatar}`)
    : undefined;

  return (
    <AppScaffold>
      <PageContainer>
        <HeroBanner 
          title={name}
          subtitle={branch}
          accent="neutral"
          showPortrait={true}
          imageUrl={displayAvatar}
          rightElement={<IconButton icon={<Settings size={24} color={colors.light.text} />} variant="ghost" onPress={() => router.push('/profile/edit')} accessibilityLabel="Edit profile" />}
        />

        <SectionHeader title="Academic Information" />
        <AppCard padding="lg" style={styles.card}>
          <InfoRow 
            label="Branch" 
            value={branch} 
            icon={<BookOpen size={16} color={colors.light.textMuted} />} 
          />
          <Divider />
          <InfoRow 
            label="Current Semester" 
            value={semester} 
            icon={<User size={16} color={colors.light.textMuted} />} 
          />
          <Divider />
          <InfoRow 
            label="Enrollment Number" 
            value={enrollment} 
            icon={<Hash size={16} color={colors.light.textMuted} />} 
          />
        </AppCard>

        <SectionHeader title="Account Settings" />
        <View style={styles.actionsContainer}>
          <SecondaryButton label="Edit Profile" style={styles.actionButton} onPress={() => router.push('/profile/edit')} />
          <SecondaryButton label="AI Companion Settings" style={styles.actionButton} onPress={() => router.push('/settings/pairing')} />
          <SecondaryButton label={isExporting ? "Exporting…" : "Export My Data"} style={styles.actionButton} onPress={exportData} disabled={isExporting} loading={isExporting} />
          <SecondaryButton label={isImporting ? "Importing…" : "Import Data"} style={styles.actionButton} onPress={importData} disabled={isImporting} loading={isImporting} />
          <SecondaryButton label="About local data" style={[styles.actionButton, styles.signOutButton]} onPress={() => Alert.alert('Your data stays on this device', 'UniOS does not use an online account yet. You can export a backup above.')} />
        </View>

      </PageContainer>
    </AppScaffold>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    marginBottom: spacing.md,
  },
  actionsContainer: {
    gap: spacing.md,
  },
  actionButton: {
    width: '100%',
    justifyContent: 'flex-start',
    paddingHorizontal: spacing.xl,
  },
  signOutButton: {
    borderColor: `${colors.light.danger}50`,
  }
});
