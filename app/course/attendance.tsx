import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, MoreHorizontal, ShieldCheck, Edit3, AlertCircle } from 'lucide-react-native';
import { colors } from '../../tokens';
import { AttendanceService, AttendanceStats } from '../../domains/attendance/service';

type Tab = 'local' | 'portal';
type Filter = 'overall' | 'theory' | 'lab';

export default function AttendanceScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('local');
  const [activeFilter, setActiveFilter] = useState<Filter>('overall');
  const [loading, setLoading] = useState(true);
  
  const [localCourses, setLocalCourses] = useState<AttendanceStats[]>([]);
  const [portalCourses, setPortalCourses] = useState<AttendanceStats[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const local = await AttendanceService.getLocalAttendanceState();
      const portal = await AttendanceService.getPortalAttendanceState();
      
      setLocalCourses(local);
      setPortalCourses(portal);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const currentCourses = activeTab === 'local' ? localCourses : portalCourses;

  // Aggregate overall stats
  let totalAttended = 0;
  let totalMissed = 0;
  let totalExempt = 0;
  
  currentCourses.forEach(c => {
    totalAttended += c.overallAttended;
    totalMissed += c.overallMissed;
    totalExempt += c.overallExempt;
  });
  
  const totalRelevant = totalAttended + totalMissed;
  const overallPercentage = totalRelevant > 0 ? Math.round((totalAttended / totalRelevant) * 100) : null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <ArrowLeft size={24} color={colors.light.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Attendance</Text>
        <TouchableOpacity style={styles.iconBtn}>
          <MoreHorizontal size={24} color={colors.light.text} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <View style={styles.tabBg}>
          <TouchableOpacity 
            style={[styles.tabBtn, activeTab === 'local' && styles.tabBtnActive]}
            onPress={() => setActiveTab('local')}
          >
            <Text style={[styles.tabText, activeTab === 'local' && styles.tabTextActive]}>My Record</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tabBtn, activeTab === 'portal' && styles.tabBtnActive]}
            onPress={() => setActiveTab('portal')}
          >
            <Text style={[styles.tabText, activeTab === 'portal' && styles.tabTextActive]}>Portal Record</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content}>
        {/* State Information Notice */}
        {activeTab === 'portal' ? (
          <View style={[styles.noticeBox, { backgroundColor: colors.light.surface, borderColor: colors.light.border }]}>
            <ShieldCheck size={20} color={colors.light.textMuted} />
            <View style={styles.noticeTextWrapper}>
              <Text style={styles.noticeTitle}>Teacher-marked Attendance</Text>
              <Text style={styles.noticeSub}>Last synced: 12 Aug 2026. Portal data is strictly read-only and may be older than your latest classes.</Text>
            </View>
          </View>
        ) : (
          <View style={[styles.noticeBox, { backgroundColor: colors.light.accent + '10', borderColor: colors.light.accent + '30' }]}>
            <Edit3 size={20} color={colors.light.accent} />
            <View style={styles.noticeTextWrapper}>
              <Text style={[styles.noticeTitle, { color: colors.light.accent }]}>Live Planning</Text>
              <Text style={[styles.noticeSub, { color: colors.light.accent }]}>Manually maintained by you. Local edits will never alter the Portal Record.</Text>
            </View>
          </View>
        )}

        {/* Hero Circular Progress */}
        <View style={styles.heroSection}>
          <View style={styles.circleProgressWrapper}>
            <View style={styles.circleProgress}>
              <Text style={styles.percentageText}>{overallPercentage !== null ? `${overallPercentage}%` : '-'}</Text>
              <Text style={styles.percentageSub}>Current projection</Text>
            </View>
          </View>
          {activeTab === 'local' && overallPercentage !== null && overallPercentage < 75 && totalRelevant > 0 && (
            <View style={styles.actionBanner}>
              <AlertCircle size={16} color={colors.light.danger} />
              <Text style={styles.actionBannerText}>Critically below 75% threshold.</Text>
            </View>
          )}
        </View>

        {/* Summary Stats */}
        <View style={styles.statsRow}>
          <View style={[styles.statBox, { backgroundColor: colors.light.success + '10' }]}>
            <Text style={styles.statLabel}>Attended</Text>
            <Text style={[styles.statValue, { color: colors.light.success }]}>{totalAttended}</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: colors.light.danger + '10' }]}>
            <Text style={styles.statLabel}>Missed</Text>
            <Text style={[styles.statValue, { color: colors.light.danger }]}>{totalMissed}</Text>
          </View>
          {totalExempt > 0 && (
            <View style={[styles.statBox, { backgroundColor: colors.light.warning + '10' }]}>
              <Text style={styles.statLabel}>Exempt</Text>
              <Text style={[styles.statValue, { color: colors.light.warning }]}>{totalExempt}</Text>
            </View>
          )}
          <View style={[styles.statBox, { backgroundColor: colors.light.surfaceElevated }]}>
            <Text style={styles.statLabel}>Total</Text>
            <Text style={styles.statValue}>{totalRelevant}</Text>
          </View>
        </View>

        {/* Filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          <View style={styles.filterRow}>
            {(['overall', 'theory', 'lab'] as Filter[]).map(f => (
              <TouchableOpacity 
                key={f} 
                style={[styles.filterPill, activeFilter === f && styles.filterPillActive]}
                onPress={() => setActiveFilter(f)}
              >
                <Text style={[styles.filterText, activeFilter === f && styles.filterTextActive]}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Subject List */}
        {loading ? (
           <ActivityIndicator size="large" color={colors.light.accent} style={{ marginTop: 40 }} />
        ) : currentCourses.length > 0 ? (
          <View style={styles.subjectList}>
            {currentCourses.map(course => {
              // Filter components if needed
              const comps = activeFilter === 'overall' 
                ? course.components 
                : course.components.filter(c => c.type === activeFilter);
              
              if (comps.length === 0 && activeFilter !== 'overall') return null;

              // Aggregate for this specific course card based on active filter
              let courseAtt = 0, courseMiss = 0, courseEx = 0;
              if (activeFilter === 'overall') {
                courseAtt = course.overallAttended;
                courseMiss = course.overallMissed;
                courseEx = course.overallExempt;
              } else {
                comps.forEach(c => {
                  courseAtt += c.attended;
                  courseMiss += c.missed;
                  courseEx += c.exempt;
                });
              }
              const courseTot = courseAtt + courseMiss;
              const coursePerc = courseTot > 0 ? Math.round((courseAtt / courseTot) * 100) : null;

              return (
                <View key={course.workspaceId} style={styles.subjectCard}>
                  <View style={styles.subjectHeader}>
                    <View style={styles.subjectNameRow}>
                      <View style={[styles.colorDot, { backgroundColor: course.workspaceColor }]} />
                      <Text style={styles.subjectNameText}>{course.workspaceName}</Text>
                    </View>
                    <Text style={[styles.subjectPercText, coursePerc !== null && coursePerc < 75 ? { color: colors.light.danger } : { color: colors.light.success }]}>
                      {coursePerc !== null ? `${coursePerc}%` : '-'}
                    </Text>
                  </View>
                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: coursePerc !== null ? `${coursePerc}%` : '0%', backgroundColor: coursePerc !== null && coursePerc < 75 ? colors.light.danger : colors.light.success }]} />
                  </View>
                  <View style={styles.componentsRow}>
                    {comps.map(c => (
                      <Text key={c.id} style={styles.componentBadge}>{c.type.toUpperCase()} ({c.percentage}%)</Text>
                    ))}
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No courses found.</Text>
            <Text style={styles.emptySub}>Please set up a course first.</Text>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.light.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8,
  },
  iconBtn: { padding: 8 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: colors.light.text, fontFamily: 'Inter' },
  
  tabContainer: { paddingHorizontal: 20, marginBottom: 16 },
  tabBg: { flexDirection: 'row', backgroundColor: colors.light.surface, borderRadius: 12, padding: 4 },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  tabBtnActive: { backgroundColor: colors.light.surfaceElevated, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  tabText: { fontSize: 14, fontWeight: '600', color: colors.light.textMuted, fontFamily: 'Inter' },
  tabTextActive: { color: colors.light.text },

  content: { flex: 1 },
  
  noticeBox: { flexDirection: 'row', marginHorizontal: 20, marginBottom: 24, padding: 16, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  noticeTextWrapper: { flex: 1, marginLeft: 12 },
  noticeTitle: { fontSize: 14, fontWeight: '700', color: colors.light.text, fontFamily: 'Inter' },
  noticeSub: { fontSize: 12, color: colors.light.textMuted, fontFamily: 'Inter', marginTop: 4, lineHeight: 18 },

  heroSection: { alignItems: 'center', marginBottom: 32 },
  circleProgressWrapper: { width: 200, height: 200, borderRadius: 100, borderWidth: 16, borderColor: colors.light.surface, justifyContent: 'center', alignItems: 'center' },
  circleProgress: { alignItems: 'center' },
  percentageText: { fontSize: 48, fontWeight: '700', color: colors.light.text, fontFamily: 'Inter', letterSpacing: -1 },
  percentageSub: { fontSize: 14, color: colors.light.textMuted, fontFamily: 'Inter', marginTop: 4 },
  
  actionBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.light.danger + '10', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 24, marginTop: 24 },
  actionBannerText: { fontSize: 13, fontWeight: '600', color: colors.light.danger, fontFamily: 'Inter', marginLeft: 8 },

  statsRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 12, marginBottom: 32 },
  statBox: { flex: 1, paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  statLabel: { fontSize: 12, fontWeight: '600', color: colors.light.textMuted, fontFamily: 'Inter', marginBottom: 8 },
  statValue: { fontSize: 24, fontWeight: '700', color: colors.light.text, fontFamily: 'Inter' },

  filterScroll: { paddingHorizontal: 20, marginBottom: 20 },
  filterRow: { flexDirection: 'row', gap: 12, paddingRight: 40 },
  filterPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.light.surface, borderWidth: 1, borderColor: colors.light.border },
  filterPillActive: { backgroundColor: colors.light.primary, borderColor: colors.light.primary },
  filterText: { fontSize: 14, fontWeight: '600', color: colors.light.textMuted, fontFamily: 'Inter' },
  filterTextActive: { color: '#FFF' },

  subjectList: { paddingHorizontal: 20, paddingBottom: 40, gap: 16 },
  subjectCard: { backgroundColor: colors.light.surfaceElevated, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.light.border },
  subjectHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  subjectNameRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  colorDot: { width: 12, height: 12, borderRadius: 6, marginRight: 12 },
  subjectNameText: { fontSize: 16, fontWeight: '600', color: colors.light.text, fontFamily: 'Inter', flex: 1 },
  subjectPercText: { fontSize: 16, fontWeight: '700', fontFamily: 'Inter' },
  
  progressBarBg: { height: 8, backgroundColor: colors.light.surface, borderRadius: 4, overflow: 'hidden', marginBottom: 12 },
  progressBarFill: { height: '100%', borderRadius: 4 },
  
  componentsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  componentBadge: { fontSize: 10, fontWeight: '700', color: colors.light.textMuted, backgroundColor: colors.light.surface, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, overflow: 'hidden' },

  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.light.text, fontFamily: 'Inter' },
  emptySub: { fontSize: 14, color: colors.light.textMuted, fontFamily: 'Inter', marginTop: 8 },
});
