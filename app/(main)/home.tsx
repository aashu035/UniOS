import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Bell, Search, CloudRain, Sun, Cloud, AlertCircle, BookOpen, Clock, MapPin } from 'lucide-react-native';
import { colors } from '../../tokens';
import { CalendarService, EffectiveOccurrence } from '../../domains/calendar/service';
import { AttendanceService } from '../../domains/attendance/service';
import { TaskRepository } from '../../domains/task/repository';
import { getLocalDateString } from '../../core/utils/date';

export default function HomeScreen() {
  const router = useRouter();
  const [schedule, setSchedule] = useState<EffectiveOccurrence[]>([]);
  const [weatherState, setWeatherState] = useState({ state: 'Balanced week', description: '', icon: Cloud });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const today = new Date();
        const nextWeek = new Date(today);
        nextWeek.setDate(nextWeek.getDate() + 7);
        
        const todayStr = getLocalDateString(today);
        const nextWeekStr = getLocalDateString(nextWeek);
        
        const effectiveSchedule = await CalendarService.getEffectiveSchedule(todayStr, nextWeekStr);
        
        // Split for today's timeline
        const todaysClasses = effectiveSchedule.filter(e => e.date === todayStr);
        setSchedule(todaysClasses);

        // Calculate Academic Weather for next 7 days
        let totalLabs = 0;
        let totalClasses = effectiveSchedule.length;
        
        for (const occ of effectiveSchedule) {
          if (occ.componentType === 'lab') totalLabs++;
        }

        // Mock tasks / exams fetch
        const pendingTasks = await TaskRepository.getTasksDueSoon();
        const deadlinesCount = pendingTasks.length;
        const mockExams = 0;
        
        // Removed fake attendance risk projection
        let criticalCount = 0;

        // Assemble Facts
        const facts = {
          upcomingClasses: totalClasses,
          labs: totalLabs,
          deadlines: deadlinesCount,
          exams: 0,
          attendanceRisks: criticalCount
        };

        const weather = CalendarService.calculateAcademicWeather(facts);
        
        let icon = Cloud;
        if (weather.state === 'Heavy week') icon = CloudRain;
        else if (weather.state === 'Busy week') icon = AlertCircle;
        else if (weather.state === 'Light week') icon = Sun;

        setWeatherState({ ...weather, icon });

      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const WeatherIcon = weatherState.icon;

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.light.accent} />
          <Text style={styles.loadingText}>Loading today's schedule...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topBar}>
        <Search size={24} color={colors.light.text} />
        <View style={styles.bellWrapper}>
          <Bell size={24} color={colors.light.text} />
          <View style={styles.redDot} />
        </View>
      </View>

      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Today</Text>
          <Text style={styles.headerSubtitle}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</Text>
        </View>

        {/* Academic Weather */}
        <TouchableOpacity style={styles.weatherCard} onPress={() => router.push('/tasks')}>
          <View style={styles.weatherIconBg}>
            <WeatherIcon size={24} color={colors.light.accent} />
          </View>
          <View style={styles.weatherContent}>
            <Text style={styles.weatherTitle}>{weatherState.state}</Text>
            <Text style={styles.weatherDesc}>{weatherState.description}</Text>
          </View>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Classes</Text>
        
        {schedule.length > 0 ? (
          <View style={styles.timeline}>
            {schedule.map((item, index) => (
              <View key={item.id} style={styles.timelineItem}>
                <View style={styles.timelineTime}>
                  <Text style={styles.timeText}>{item.startTime}</Text>
                  <Text style={styles.timeSubText}>{item.endTime}</Text>
                </View>
                <View style={styles.timelineLine}>
                  <View style={[styles.timelineDot, { backgroundColor: item.workspaceColor }]} />
                  {index !== schedule.length - 1 && <View style={styles.timelineConnector} />}
                </View>
                <TouchableOpacity 
                  style={[styles.timelineCard, item.isException && styles.timelineCardException]} 
                  onPress={() => router.push(`/workspace/${item.workspaceId}`)}
                >
                  <View style={styles.cardHeader}>
                    <View style={[styles.subjectIcon, { backgroundColor: item.workspaceColor + '20' }]}>
                      <BookOpen size={20} color={item.workspaceColor} />
                    </View>
                    <View style={styles.cardInfo}>
                      <Text style={styles.subjectName}>{item.workspaceName}</Text>
                      <Text style={styles.subjectType}>{item.componentType.toUpperCase()}</Text>
                    </View>
                  </View>
                  <View style={styles.cardFooter}>
                    <View style={styles.footerItem}>
                      <MapPin size={14} color={colors.light.textMuted} />
                      <Text style={styles.footerText}>{item.venueName || 'TBD'}</Text>
                    </View>
                    {item.isException && (
                      <View style={styles.exceptionBadge}>
                        <Text style={styles.exceptionText}>{item.exceptionAction}</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Nothing scheduled.</Text>
            <Text style={styles.emptySub}>Enjoy the empty day.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.light.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, color: colors.light.textMuted, fontFamily: 'Inter' },
  
  topBar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  bellWrapper: { position: 'relative' },
  redDot: { position: 'absolute', top: 2, right: 2, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.light.danger },
  
  container: { flex: 1, paddingHorizontal: 20 },
  header: { marginBottom: 24, marginTop: 8 },
  headerTitle: { fontSize: 34, fontWeight: '700', color: colors.light.text, fontFamily: 'Inter', letterSpacing: -1 },
  headerSubtitle: { fontSize: 16, color: colors.light.textMuted, fontFamily: 'Inter', marginTop: 4 },
  
  weatherCard: { 
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.light.surface, 
    borderRadius: 20, padding: 16, marginBottom: 32,
    borderWidth: 1, borderColor: colors.light.border
  },
  weatherIconBg: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.light.surfaceElevated, justifyContent: 'center', alignItems: 'center', marginRight: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  weatherContent: { flex: 1 },
  weatherTitle: { fontSize: 16, fontWeight: '600', color: colors.light.text, fontFamily: 'Inter' },
  weatherDesc: { fontSize: 14, color: colors.light.textMuted, fontFamily: 'Inter', marginTop: 2 },

  sectionTitle: { fontSize: 20, fontWeight: '700', color: colors.light.text, fontFamily: 'Inter', marginBottom: 16 },
  
  timeline: { paddingLeft: 8 },
  timelineItem: { flexDirection: 'row', marginBottom: 16 },
  timelineTime: { width: 60, alignItems: 'flex-end', paddingRight: 16, paddingTop: 16 },
  timeText: { fontSize: 14, fontWeight: '600', color: colors.light.text, fontFamily: 'Inter' },
  timeSubText: { fontSize: 12, color: colors.light.textMuted, fontFamily: 'Inter', marginTop: 2 },
  
  timelineLine: { width: 24, alignItems: 'center', position: 'relative' },
  timelineDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.light.accent, marginTop: 18, zIndex: 2 },
  timelineConnector: { position: 'absolute', top: 30, bottom: -30, width: 2, backgroundColor: colors.light.border, zIndex: 1 },
  
  timelineCard: { 
    flex: 1, backgroundColor: colors.light.surfaceElevated, borderRadius: 16, padding: 16, marginLeft: 8,
    borderWidth: 1, borderColor: colors.light.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 2
  },
  timelineCardException: { borderStyle: 'dashed', borderColor: colors.light.warning },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  subjectIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  cardInfo: { flex: 1 },
  subjectName: { fontSize: 16, fontWeight: '600', color: colors.light.text, fontFamily: 'Inter' },
  subjectType: { fontSize: 12, fontWeight: '700', color: colors.light.textMuted, fontFamily: 'Inter', marginTop: 4, letterSpacing: 0.5 },
  
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.light.surface },
  footerItem: { flexDirection: 'row', alignItems: 'center' },
  footerText: { fontSize: 13, color: colors.light.textMuted, fontFamily: 'Inter', marginLeft: 6 },
  
  exceptionBadge: { backgroundColor: colors.light.warning + '20', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  exceptionText: { fontSize: 10, fontWeight: '700', color: colors.light.warning, textTransform: 'uppercase' },

  emptyState: { alignItems: 'center', paddingVertical: 48, backgroundColor: colors.light.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.light.border },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.light.text, fontFamily: 'Inter' },
  emptySub: { fontSize: 14, color: colors.light.textMuted, fontFamily: 'Inter', marginTop: 4 },
});
