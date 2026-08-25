import React, { useState, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { PageContainer } from '../../../components/layout/PageContainer';
import { SectionHeader } from '../../../components/layout/SectionHeader';
import { AppCard } from '../../../components/cards/AppCard';
import { AttendanceRing } from '../../../components/feedback/AttendanceRing';
import { AttendanceChart } from '../../../components/feedback/AttendanceChart';
import { AttendanceWeekStrip } from '../../../components/ui/AttendanceWeekStrip';
import { AttendanceDayList } from '../../../components/ui/AttendanceDayList';
import { AttendanceItem } from '../../../components/cards/AttendanceItem';
import { colors, spacing, typography, radius } from '../../../tokens';
import { useLocalSearchParams } from 'expo-router';
import { useAttendance, useAttendanceViewModel } from '../../../domains/attendance/hooks';
import { AttendanceRepository } from '../../../domains/attendance/repository';
import * as Haptics from 'expo-haptics';
import { Skeleton } from '../../../components/ui/Skeleton';
import { getLocalDateString } from '../../../core/utils/date';
import { useWorkspace } from '../../../domains/workspace/hooks';

export default function WorkspaceAttendance() {
  const { id } = useLocalSearchParams();
  const workspaceId = parseInt(id as string, 10);
  
  // Keep standard attendance hook for portal data
  const { portalData, refreshAttendance: refreshPortal } = useAttendance(workspaceId);
  const { workspaceData } = useWorkspace(workspaceId);
  
  const today = new Date();
  const [selectedDateStr, setSelectedDateStr] = useState<string>(getLocalDateString(today));
  
  // Calculate Week boundaries based on selectedDateStr
  const { weekStartStr, weekEndStr } = useMemo(() => {
    const d = new Date(selectedDateStr);
    const day = d.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day; // 0 is Sunday
    const monday = new Date(d);
    monday.setDate(d.getDate() + diffToMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return {
      weekStartStr: getLocalDateString(monday),
      weekEndStr: getLocalDateString(sunday)
    };
  }, [selectedDateStr]);

  const scope = useMemo(() => ({ workspaceId }), [workspaceId]);

  const { viewModel, isLoading, refreshViewModel } = useAttendanceViewModel(
    scope, 
    weekStartStr, 
    weekEndStr, 
    selectedDateStr
  );

  const [isMarking, setIsMarking] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'self' | 'portal'>('self');
  const isPortalMode = viewMode === 'portal';

  const targetAttendance = workspaceData?.workspace?.targetAttendance || 75;

  const handlePreviousWeek = () => {
    const d = new Date(weekStartStr);
    d.setDate(d.getDate() - 7);
    setSelectedDateStr(getLocalDateString(d)); // Select Monday of previous week
  };

  const handleNextWeek = () => {
    const d = new Date(weekStartStr);
    d.setDate(d.getDate() + 7);
    setSelectedDateStr(getLocalDateString(d)); // Select Monday of next week
  };

  const handleMark = async (occurrence: any, status: 'present' | 'absent' | 'cancelled' | 'holiday' | 'exempt', notes?: string) => {
    setIsMarking(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await AttendanceRepository.markAttendance(
        workspaceId, 
        selectedDateStr, 
        status, 
        occurrence.occurrenceId, 
        occurrence.componentId, 
        notes
      );
      await refreshViewModel();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      console.error(e);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Could not save attendance.');
    } finally {
      setIsMarking(false);
    }
  };

  const promptMarkAttendance = (occurrence: any) => {
    Alert.alert(
      `Mark Attendance`,
      `How would you like to mark ${occurrence.componentType} class?`,
      [
        { text: 'Present', onPress: () => handleMark(occurrence, 'present') },
        { text: 'Absent', onPress: () => handleMark(occurrence, 'absent') },
        { text: 'On Leave (Exempt)', onPress: () => handleMark(occurrence, 'exempt', 'Duty / Medical') },
        { text: 'Cancelled', onPress: () => handleMark(occurrence, 'cancelled', 'Class cancelled') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleChangeRecord = (occurrence: any) => {
    if (viewMode === 'portal') return;
    Alert.alert(
      `Change Record`,
      `Currently marked as: ${occurrence.status.toUpperCase()}\nWhat should it be?`,
      [
        { text: 'Present', onPress: () => handleMark(occurrence, 'present') },
        { text: 'Absent', onPress: () => handleMark(occurrence, 'absent') },
        { text: 'On Leave (Exempt)', onPress: () => handleMark(occurrence, 'exempt', 'Duty / Medical') },
        { text: 'Cancelled', onPress: () => handleMark(occurrence, 'cancelled', 'Class cancelled') },
        { text: 'Clear / Delete', style: 'destructive', onPress: async () => { 
            await AttendanceRepository.deleteAttendance(occurrence.occurrenceId); 
            await refreshViewModel(); 
          } 
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  // Metrics resolution
  let displayTotal = 0;
  let displayAttended = 0;
  let displayMissed = 0;
  let displayExempt = 0;
  let finalPercentage: number | null = null;
  let recoveryText = "";

  if (isPortalMode) {
    if (portalData) {
      displayTotal = portalData.portalTotal || 0;
      displayAttended = portalData.portalPresent || 0;
      displayMissed = displayTotal - displayAttended;
      finalPercentage = portalData.portalPercent || null;
      const syncDate = new Date(portalData.checkedDate).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
      recoveryText = `Last synced: ${syncDate}\n\nOFFICIAL • READ ONLY`;
    } else {
      recoveryText = "Connect/sync to retrieve the official record.\n\nOFFICIAL • READ ONLY";
    }
  } else if (viewModel) {
    displayTotal = viewModel.summary.totalScheduled;
    displayAttended = viewModel.summary.present;
    displayMissed = viewModel.summary.absent;
    displayExempt = viewModel.summary.exempt;
    finalPercentage = viewModel.summary.percentage;
    
    if (viewModel.summary.denominator === 0) {
      recoveryText = "Mark attendance to start tracking";
    } else if (finalPercentage !== null) {
      if (finalPercentage >= targetAttendance) {
        const attendedEffective = displayAttended + displayExempt;
        const denomEffective = viewModel.summary.denominator;
        const margin = Math.floor((attendedEffective * 100 - targetAttendance * denomEffective) / targetAttendance);
        recoveryText = margin > 0 ? `You can miss ${margin} class${margin !== 1 ? 'es' : ''} and stay above ${targetAttendance}%` : `You are exactly at target (${targetAttendance}%)`;
      } else {
        const t = targetAttendance / 100;
        const denomEffective = viewModel.summary.denominator;
        const attendedEffective = displayAttended + displayExempt;
        const required = Math.ceil((t * denomEffective - attendedEffective) / (1 - t));
        recoveryText = `Attend the next ${required} class${required !== 1 ? 'es' : ''} to reach ${targetAttendance}%`;
      }
    }
  }

  const handleRefresh = async () => {
    await refreshViewModel();
    await refreshPortal();
  };

  return (
    <ScrollView 
      style={styles.container} 
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={handleRefresh} />}
    >
      <PageContainer>
        {/* View Mode Toggle */}
        <View style={styles.toggleContainer}>
          <TouchableOpacity 
            style={[styles.toggleButton, viewMode === 'self' && styles.toggleActive]} 
            onPress={() => setViewMode('self')}
          >
            <Text style={[styles.toggleText, viewMode === 'self' && styles.toggleTextActive]}>My Tracking</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.toggleButton, viewMode === 'portal' && styles.toggleActive]} 
            onPress={() => setViewMode('portal')}
          >
            <Text style={[styles.toggleText, viewMode === 'portal' && styles.toggleTextActive]}>Official Portal</Text>
          </TouchableOpacity>
        </View>

        {isPortalMode && !portalData && (
          <View style={styles.portalWarning}>
            <Text style={styles.portalWarningText}>Official Portal data unavailable. Last synced: Never.</Text>
          </View>
        )}

        {/* Dashboard Visualization */}
        <AppCard style={styles.heroCard}>
          {isPortalMode ? (
            <AttendanceRing percentage={finalPercentage} size={120} strokeWidth={12} />
          ) : (
            viewModel && <AttendanceChart metrics={viewModel.summary} size={120} strokeWidth={12} />
          )}
          
          <View style={styles.heroText}>
            <Text style={styles.heroTitle}>{finalPercentage === null ? "No Data" : `${finalPercentage}%`}</Text>
            <Text style={[styles.heroSubtitle, isPortalMode && { fontWeight: '600' }]}>{recoveryText}</Text>
          </View>
        </AppCard>

        <View style={styles.statsRow}>
          <AppCard style={styles.statBox} padding="md">
            <Text style={[styles.statValue, { color: (colors.light.attendanceStatus as any).present.color }]}>{isPortalMode && !portalData ? '-' : displayAttended}</Text>
            <Text style={styles.statLabel}>Present</Text>
          </AppCard>
          <AppCard style={styles.statBox} padding="md">
            <Text style={[styles.statValue, { color: (colors.light.attendanceStatus as any).absent.color }]}>{isPortalMode && !portalData ? '-' : displayMissed}</Text>
            <Text style={styles.statLabel}>Absent</Text>
          </AppCard>
          {!isPortalMode && (
            <AppCard style={styles.statBox} padding="md">
              <Text style={[styles.statValue, { color: (colors.light.attendanceStatus as any).exempt.color }]}>{displayExempt}</Text>
              <Text style={styles.statLabel}>Leave</Text>
            </AppCard>
          )}
          <AppCard style={styles.statBox} padding="md">
            <Text style={styles.statValue}>{isPortalMode && !portalData ? '-' : (isPortalMode ? displayTotal : displayTotal)}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </AppCard>
        </View>

        {/* Self Tracking Interactive UI */}
        {!isPortalMode && viewModel && (
          <>
            <AttendanceWeekStrip
              days={viewModel.week.days}
              selectedDate={selectedDateStr}
              onSelectDate={setSelectedDateStr}
              weekStartDate={weekStartStr}
              weekEndDate={weekEndStr}
              onPreviousWeek={handlePreviousWeek}
              onNextWeek={handleNextWeek}
            />

            <AttendanceDayList
              date={selectedDateStr}
              occurrences={viewModel.selectedDay.occurrences}
              onMarkAttendance={(occ) => {
                if (occ.status === 'unmarked' || occ.status === 'upcoming') {
                  promptMarkAttendance(occ);
                } else {
                  handleChangeRecord(occ);
                }
              }}
              isLoading={isMarking}
            />
            
            <SectionHeader title="Recent History" />
            {viewModel.recent.length > 0 ? (
              viewModel.recent.map(group => (
                <View key={group.date} style={styles.historyGroup}>
                  <Text style={styles.historyGroupDate}>
                    {new Date(group.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </Text>
                  {group.occurrences.map(occ => (
                    <AttendanceItem
                      key={occ.occurrenceId}
                      isTimeline={false}
                      date={occ.date}
                      status={occ.status as any}
                      type={occ.componentType}
                      notes={occ.notes}
                      onLongPress={() => handleChangeRecord(occ)}
                    />
                  ))}
                </View>
              ))
            ) : (
              <AppCard padding="md">
                <Text style={styles.emptyText}>No marked attendance history yet.</Text>
              </AppCard>
            )}
          </>
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
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: colors.light.surface,
    borderRadius: radius.full,
    padding: 4,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radius.full,
  },
  toggleActive: {
    backgroundColor: colors.light.primary,
  },
  toggleText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.light.textMuted,
  },
  toggleTextActive: {
    color: '#fff',
  },
  portalWarning: {
    backgroundColor: colors.light.warning + '20',
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  portalWarningText: {
    color: colors.light.warning,
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
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
    marginBottom: spacing.xl,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
  },
  statLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.light.textMuted,
    marginTop: 4,
  },
  historyGroup: {
    marginBottom: spacing.md,
  },
  historyGroupDate: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.light.textMuted,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  emptyText: {
    color: colors.light.textMuted,
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
  }
});
