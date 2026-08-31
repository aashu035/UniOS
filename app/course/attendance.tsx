import React, { useState, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { PageContainer } from '../../components/layout/PageContainer';
import { SectionHeader } from '../../components/layout/SectionHeader';
import { AppCard } from '../../components/cards/AppCard';
import { AttendanceRing } from '../../components/feedback/AttendanceRing';
import { AttendanceChart } from '../../components/feedback/AttendanceChart';
import { AttendanceWeekStrip } from '../../components/ui/AttendanceWeekStrip';
import { AttendanceDayList } from '../../components/ui/AttendanceDayList';
import { AttendanceItem } from '../../components/cards/AttendanceItem';
import { colors, spacing, typography, radius } from '../../tokens';
import { useRouter } from 'expo-router';
import { useAttendanceViewModel } from '../../domains/attendance/hooks';
import { AttendanceRepository } from '../../domains/attendance/repository';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, MoreHorizontal } from 'lucide-react-native';
import { getLocalDateString } from '../../core/utils/date';
import { AttendanceService } from '../../domains/attendance/service';

export default function GlobalAttendanceScreen() {
  const router = useRouter();
  
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

  const scope = useMemo(() => 'global' as const, []);

  const { viewModel, isLoading, refreshViewModel } = useAttendanceViewModel(
    scope, 
    weekStartStr, 
    weekEndStr, 
    selectedDateStr
  );

  const [isMarking, setIsMarking] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'self' | 'portal'>('self');
  const [portalData, setPortalData] = useState<any | null>(null);

  // We fetch portal stats manually here since they are aggregated
  const loadPortalData = async () => {
    try {
      const portal = await AttendanceService.getPortalAttendanceState();
      let totalAttended = 0;
      let totalMissed = 0;
      portal.forEach(c => {
        totalAttended += c.overallAttended;
        totalMissed += c.overallMissed;
      });
      const totalRelevant = totalAttended + totalMissed;
      const overallPercentage = totalRelevant > 0 ? Math.round((totalAttended / totalRelevant) * 100) : null;
      setPortalData({ totalAttended, totalMissed, totalRelevant, overallPercentage });
    } catch (e) {
      console.error(e);
    }
  };

  React.useEffect(() => {
    if (viewMode === 'portal' && !portalData) {
      loadPortalData();
    }
  }, [viewMode]);

  const isPortalMode = viewMode === 'portal';

  const handlePreviousWeek = () => {
    const d = new Date(weekStartStr);
    d.setDate(d.getDate() - 7);
    setSelectedDateStr(getLocalDateString(d));
  };

  const handleNextWeek = () => {
    const d = new Date(weekStartStr);
    d.setDate(d.getDate() + 7);
    setSelectedDateStr(getLocalDateString(d));
  };

  const handleMark = async (occurrence: any, status: 'present' | 'absent' | 'cancelled' | 'holiday' | 'exempt', notes?: string) => {
    setIsMarking(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await AttendanceRepository.markAttendance(
        occurrence.workspaceId, 
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
      `Mark Attendance - ${occurrence.workspaceName}`,
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
      `Change Record - ${occurrence.workspaceName}`,
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
      displayTotal = portalData.totalRelevant;
      displayAttended = portalData.totalAttended;
      displayMissed = portalData.totalMissed;
      finalPercentage = portalData.overallPercentage;
      recoveryText = "OFFICIAL • READ ONLY";
    } else {
      recoveryText = "Loading portal data...";
    }
  } else if (viewModel) {
    displayTotal = viewModel.summary.totalScheduled;
    displayAttended = viewModel.summary.present;
    displayMissed = viewModel.summary.absent;
    displayExempt = viewModel.summary.exempt;
    finalPercentage = viewModel.summary.percentage;
    
    if (viewModel.summary.denominator === 0) {
      recoveryText = "Mark attendance to start tracking";
    } else {
      recoveryText = "Global Attendance Overview";
    }
  }

  const handleRefresh = async () => {
    await refreshViewModel();
    if (isPortalMode) await loadPortalData();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <ArrowLeft size={24} color={colors.light.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Attendance</Text>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            Alert.alert('Attendance Options', 'Refresh data or jump back to today.', [
              { text: 'Refresh', onPress: () => handleRefresh() },
              {
                text: 'Jump to Today',
                onPress: () => setSelectedDateStr(getLocalDateString(new Date())),
              },
              { text: 'Cancel', style: 'cancel' },
            ]);
          }}
        >
          <MoreHorizontal size={24} color={colors.light.text} />
        </TouchableOpacity>
      </View>

      <ScrollView 
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
              <Text style={[styles.toggleText, viewMode === 'self' && styles.toggleTextActive]}>My Record</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.toggleButton, viewMode === 'portal' && styles.toggleActive]} 
              onPress={() => setViewMode('portal')}
            >
              <Text style={[styles.toggleText, viewMode === 'portal' && styles.toggleTextActive]}>Portal Record</Text>
            </TouchableOpacity>
          </View>

          {isPortalMode && !portalData && !isLoading && (
            <View style={styles.portalWarning}>
              <Text style={styles.portalWarningText}>Official Portal data unavailable.</Text>
            </View>
          )}

          {/* Dashboard Visualization */}
            <AppCard variant="glassPrimary" style={styles.heroCard}>
              {isPortalMode ? (
                <AttendanceRing percentage={finalPercentage} size={120} strokeWidth={12} onPrimary />
              ) : (
                viewModel && <AttendanceChart metrics={viewModel.summary} size={120} strokeWidth={12} onPrimary />
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.light.background,
    paddingTop: 44, // rough safe area padding for testing, usually use SafeAreaView
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8,
  },
  iconBtn: { padding: 8 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: colors.light.text, fontFamily: 'Inter' },
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
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  heroText: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  heroTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: typography.fontSize.sm,
    color: 'rgba(255,255,255,0.85)',
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
    backgroundColor: colors.light.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.05)',
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
