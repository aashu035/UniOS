import React from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { AppScaffold } from '../../components/layout/AppScaffold';
import { PageContainer } from '../../components/layout/PageContainer';
import { HeroBanner } from '../../components/layout/HeroBanner';
import { SectionHeader } from '../../components/layout/SectionHeader';
import { AppCard } from '../../components/cards/AppCard';
import { InfoRow } from '../../components/layout/InfoRow';
import { Divider } from '../../components/layout/Divider';
import { SecondaryButton } from '../../components/buttons/SecondaryButton';
import { IconButton } from '../../components/buttons/IconButton';
import { useProfile } from '../../domains/profile/hooks';
import { Settings, BookOpen, User, Hash } from 'lucide-react-native';
import { colors, spacing, typography } from '../../tokens';

export default function Profile() {
  const { profile, isLoading } = useProfile();

  if (isLoading) {
    return (
      <AppScaffold>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.light.primary} />
        </View>
      </AppScaffold>
    );
  }

  // Fallback data
  const name = profile?.name || 'Student Name';
  const branch = profile?.branch || 'Not specified';
  const enrollment = profile?.enrollmentNo || 'Not specified';
  const semester = profile?.currentSemester ? `Semester ${profile.currentSemester}` : 'Not specified';

  return (
    <AppScaffold>
      <PageContainer>
        <HeroBanner 
          title={name}
          subtitle={branch}
          accent="neutral"
          showPortrait={true}
          rightElement={<IconButton icon={<Settings size={24} color={colors.light.text} />} variant="ghost" />}
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
          <SecondaryButton label="Edit Profile" style={styles.actionButton} />
          <SecondaryButton label="Export My Data" style={styles.actionButton} />
          <SecondaryButton label="Sign Out" style={[styles.actionButton, styles.signOutButton]} />
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
    borderColor: `${colors.light.error}50`,
  }
});
