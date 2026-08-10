import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { PageContainer } from '../../../components/layout/PageContainer';
import { SectionHeader } from '../../../components/layout/SectionHeader';
import { AppCard } from '../../../components/cards/AppCard';
import { AttendanceRing } from '../../../components/feedback/AttendanceRing';
import { TimelineCard } from '../../../components/cards/TimelineCard';
import { colors, spacing, typography, radius } from '../../../tokens';
import { useLocalSearchParams } from 'expo-router';
import { useAttendance } from '../../../domains/attendance/hooks';
import { useHasClassToday } from '../../../domains/calendar/hooks';
import { AttendanceRepository } from '../../../domains/attendance/repository';
import { Check, X, Ban, CalendarOff } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Skeleton } from '../../../components/ui/Skeleton';

import { useWorkspace } from '../../../domains/workspace/hooks';
import { calculateAttendanceMetrics } from '../../../core/utils/attendance';

export default function WorkspaceAttendance() {
  const { id } = useLocalSearchParams();
  const workspaceId = parseInt(id as string, 10);
  const { history, portalData, isLoading, refreshAttendance } = useAttendance(workspaceId);
  const { workspaceData } = useWorkspace(workspaceId);
  const { hasClass, isLoading: checkingClass } = useHasClassToday(workspaceId);
  const [isMarking, setIsMarking] = useState(false);

  const targetAttendance = workspaceData?.workspace?.targetAttendance || 75;
  const todayStr = new Date().toISOString().split('T')[0];

  // Check if today already has a record
  const todayRecord = history.find(r => r.date === todayStr);

  const handleMark = async (status: 'present' | 'absent' | 'cancelled' | 'holiday' | 'exempt', notes?: string) => {
    setIsMarking(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await AttendanceRepository.markAttendance(workspaceId, todayStr, status, notes);
      await refreshAttendance();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      console.error(e);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Could not save attendance.');
    } finally {
      setIsMarking(false);
    }
  };

  const handleChangeRecord = (record: any) => {
    Alert.alert(
      `Change ${record.date}`,
      `Currently marked as: ${record.status.toUpperCase()}\nWhat should it be?`,
      [
        { text: 'Present', onPress: async () => { await AttendanceRepository.markAttendance(workspaceId, record.date, 'present'); refreshAttendance(); } },
        { text: 'Absent', onPress: async () => { await AttendanceRepository.markAttendance(workspaceId, record.date, 'absent'); refreshAttendance(); } },
        { text: 'Exempt (Duty/Med)', onPress: async () => { await AttendanceRepository.markAttendance(workspaceId, record.date, 'exempt', 'Duty / Medical'); refreshAttendance(); } },
        { text: 'Cancelled / Off', onPress: async () => { await AttendanceRepository.markAttendance(workspaceId, record.date, 'cancelled', 'Class cancelled'); refreshAttendance(); } },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const { present, absent, exempt, total, percentage } = calculateAttendanceMetrics(history);
  
  // Recovery math logic
  let recoveryText = "Keep it up!";
  if (total === 0) {
    recoveryText = "Mark today's attendance above to start tracking";
  } else if (percentage >= targetAttendance) {
    const margin = Math.floor(((present + exempt) * 100 - targetAttendance * total) / targetAttendance);
    recoveryText = margin > 0 ? `You can miss ${margin} class${margin !== 1 ? 'es' : ''} and stay above ${targetAttendance}%` : `You are exactly at target (${targetAttendance}%)`;
  } else {
    const t = targetAttendance / 100;
    const required = Math.ceil((t * total - (present + exempt)) / (1 - t));
    recoveryText = `Attend the next ${required} class${required !== 1 ? 'es' : ''} to reach ${targetAttendance}%`;
  }

  const displayTotal = portalData?.portalTotal || total;
  const displayAttended = portalData?.portalPresent || present;
  const displayMissed = displayTotal - displayAttended - exempt;
  const finalPercentage = portalData?.portalPercent || percentage;
  const cancelled = history.filter(r => r.status === 'cancelled' || r.status === 'holiday').length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PageContainer>
        {/* Today's Quick Mark */}
        {checkingClass ? (
          <AppCard style={styles.todayCard}>
            <Skeleton height={60} borderRadius={radius.lg} />
          </AppCard>
        ) : hasClass !== false ? (
          <AppCard style={styles.todayCard}>
            <Text style={styles.todayTitle}>Today — {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}</Text>
            {todayRecord ? (
              <View style={styles.todayMarked}>
                <View style={[styles.statusBadge, { backgroundColor: todayRecord.status === 'present' || todayRecord.status === 'exempt' ? colors.light.success + '20' : todayRecord.status === 'absent' ? colors.light.danger + '20' : colors.light.warning + '20' }]}>
                  <Text style={[styles.statusBadgeText, { color: todayRecord.status === 'present' || todayRecord.status === 'exempt' ? colors.light.success : todayRecord.status === 'absent' ? colors.light.danger : colors.light.warning }]}>
                    {todayRecord.status.charAt(0).toUpperCase() + todayRecord.status.slice(1)}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => handleChangeRecord(todayRecord)} style={styles.changeButton}>
                  <Text style={styles.changeText}>Change</Text>
                </TouchableOpacity>
              </View>
            ) : isMarking ? (
              <Skeleton height={48} borderRadius={radius.lg} />
            ) : (
              <View style={styles.markRow}>
                <TouchableOpacity style={[styles.markButton, styles.presentButton]} onPress={() => handleMark('present')}>
                  <Check size={18} color="#fff" />
                  <Text style={styles.markButtonText}>Present</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.markButton, styles.absentButton]} onPress={() => handleMark('absent')}>
                  <X size={18} color="#fff" />
                  <Text style={styles.markButtonText}>Absent</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.markButton, styles.cancelledButton]} onPress={() => {
                  Alert.alert('Other Option', 'What happened?', [
                    { text: 'Duty/Medical', onPress: () => handleMark('exempt', 'Duty / Medical') },
                    { text: 'Cancelled', onPress: () => handleMark('cancelled', 'Class cancelled') },
                    { text: 'Holiday', onPress: () => handleMark('holiday', 'Holiday') },
                    { text: 'Back', style: 'cancel' },
                  ]);
                }}>
                  <CalendarOff size={18} color="#fff" />
                  <Text style={styles.markButtonText}>Other</Text>
                </TouchableOpacity>
              </View>
            )}
          </AppCard>
        ) : null}

        {/* Stats Ring */}
        <AppCard style={styles.heroCard}>
          <AttendanceRing percentage={finalPercentage} size={120} strokeWidth={12} />
          <View style={styles.heroText}>
            <Text style={styles.heroTitle}>{displayTotal > 0 ? `${finalPercentage}%` : "No Data"}</Text>
            <Text style={styles.heroSubtitle}>{recoveryText}</Text>
          </View>
        </AppCard>

        <View style={styles.statsRow}>
          <AppCard style={styles.statBox} padding="md">
            <Text style={[styles.statValue, { color: colors.light.success }]}>{displayAttended}</Text>
            <Text style={styles.statLabel}>Attended</Text>
          </AppCard>
          <AppCard style={styles.statBox} padding="md">
            <Text style={[styles.statValue, { color: colors.light.danger }]}>{displayMissed}</Text>
            <Text style={styles.statLabel}>Missed</Text>
          </AppCard>
          <AppCard style={styles.statBox} padding="md">
            <Text style={[styles.statValue, { color: colors.light.primary }]}>{exempt}</Text>
            <Text style={styles.statLabel}>Exempt</Text>
          </AppCard>
          <AppCard style={styles.statBox} padding="md">
            <Text style={styles.statValue}>{displayTotal}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </AppCard>
        </View>

        <SectionHeader title="Recent History" />
        {history.length > 0 ? (
          history.map(record => (
            <TouchableOpacity key={record.id} onLongPress={() => handleChangeRecord(record)} activeOpacity={0.7}>
              <TimelineCard 
                time={record.date} 
                title={record.status.charAt(0).toUpperCase() + record.status.slice(1)} 
                subtitle={record.notes || 'Lecture'} 
                venue={''}
                isActive={record.status === 'present' || record.status === 'exempt'}
              />
            </TouchableOpacity>
          ))
        ) : (
          <AppCard padding="md">
            <Text style={styles.emptyText}>No attendance history yet. Mark today's class above to get started!</Text>
          </AppCard>
        )}
      </PageContainer>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.light.background,
  },
  content: {
    paddingBottom: spacing.xxl,
  },
  todayCard: {
    marginBottom: spacing.md,
    paddingVertical: spacing.lg,
  },
  todayTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.light.text,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  todayMarked: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  statusBadge: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
  },
  statusBadgeText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  changeButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  changeText: {
    color: colors.light.primary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  markRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  markButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
  },
  markButtonText: {
    color: '#fff',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  presentButton: {
    backgroundColor: colors.light.success,
  },
  absentButton: {
    backgroundColor: colors.light.danger,
  },
  cancelledButton: {
    backgroundColor: colors.light.warning,
  },
  heroCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    marginBottom: spacing.md,
  },
  heroText: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  heroTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.light.text,
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.light.textMuted,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.light.text,
  },
  statLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.light.textMuted,
    marginTop: 4,
  },
  emptyText: {
    color: colors.light.textMuted,
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
  }
});
