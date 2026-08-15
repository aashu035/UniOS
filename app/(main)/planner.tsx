import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, MapPin, BookOpen, Search, Filter } from 'lucide-react-native';
import { colors } from '../../tokens';
import { CalendarService, EffectiveOccurrence } from '../../domains/calendar/service';

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function TimetableScreen() {
  const router = useRouter();
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const d = new Date();
    // Set to Monday of current week
    const day = d.getDay() === 0 ? 7 : d.getDay();
    d.setDate(d.getDate() - day + 1);
    d.setHours(0,0,0,0);
    return d;
  });
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [schedule, setSchedule] = useState<EffectiveOccurrence[]>([]);
  const [loading, setLoading] = useState(false);
  const [tasksDueSoon, setTasksDueSoon] = useState(2); // Mock for contextual tasks
  
  useEffect(() => {
    loadWeekData(currentWeekStart);
  }, [currentWeekStart]);

  const loadWeekData = async (weekStart: Date) => {
    setLoading(true);
    try {
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      
      const effective = await CalendarService.getEffectiveSchedule(
        weekStart.toISOString().split('T')[0],
        weekEnd.toISOString().split('T')[0]
      );
      setSchedule(effective);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const getWeekRangeLabel = () => {
    const end = new Date(currentWeekStart);
    end.setDate(end.getDate() + 6);
    const startStr = currentWeekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${startStr} - ${endStr}`;
  };

  const shiftWeek = (direction: 'prev' | 'next' | 'today') => {
    if (direction === 'today') {
      const d = new Date();
      const day = d.getDay() === 0 ? 7 : d.getDay();
      d.setDate(d.getDate() - day + 1);
      d.setHours(0,0,0,0);
      setCurrentWeekStart(d);
      setSelectedDate(new Date());
    } else {
      const newStart = new Date(currentWeekStart);
      newStart.setDate(newStart.getDate() + (direction === 'next' ? 7 : -7));
      setCurrentWeekStart(newStart);
      // Select the Monday of that week
      setSelectedDate(newStart);
    }
  };

  const selectedDateStr = selectedDate.toISOString().split('T')[0];
  const daySchedule = schedule.filter(s => s.date === selectedDateStr);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>Timetable</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.iconBtn}><Search size={20} color={colors.light.text} /></TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn}><Filter size={20} color={colors.light.text} /></TouchableOpacity>
          </View>
        </View>

        {/* Historical Navigation */}
        <View style={styles.weekNavigator}>
          <TouchableOpacity onPress={() => shiftWeek('prev')} style={styles.navBtn}>
            <ChevronLeft size={24} color={colors.light.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => shiftWeek('today')} style={styles.navCenterBtn}>
            <CalendarIcon size={16} color={colors.light.textMuted} />
            <Text style={styles.weekLabel}>{getWeekRangeLabel()}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => shiftWeek('next')} style={styles.navBtn}>
            <ChevronRight size={24} color={colors.light.text} />
          </TouchableOpacity>
        </View>

        {/* Date Strip */}
        <View style={styles.dateStrip}>
          {[0,1,2,3,4,5,6].map((offset) => {
            const d = new Date(currentWeekStart);
            d.setDate(d.getDate() + offset);
            const isSelected = d.toISOString().split('T')[0] === selectedDateStr;
            const isToday = d.toISOString().split('T')[0] === new Date().toISOString().split('T')[0];
            
            return (
              <TouchableOpacity 
                key={offset} 
                style={[styles.dateBox, isSelected && styles.dateBoxSelected]}
                onPress={() => setSelectedDate(d)}
              >
                <Text style={[styles.dayName, isSelected && styles.dayNameSelected]}>{DAYS_OF_WEEK[d.getDay()]}</Text>
                <View style={[styles.dateCircle, isToday && !isSelected && styles.dateCircleToday]}>
                  <Text style={[styles.dateNumber, isSelected && styles.dateNumberSelected]}>{d.getDate()}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Contextual Tasks summary */}
        {tasksDueSoon > 0 && (
          <TouchableOpacity style={styles.contextualTasksBanner} onPress={() => router.push('/(main)/tasks')}>
            <View style={styles.contextualIcon}>
              <Clock size={16} color={colors.light.warning} />
            </View>
            <Text style={styles.contextualText}>{tasksDueSoon} tasks due soon</Text>
            <ChevronRight size={16} color={colors.light.textMuted} />
          </TouchableOpacity>
        )}

        {loading ? (
          <ActivityIndicator size="large" color={colors.light.accent} style={{ marginTop: 40 }} />
        ) : daySchedule.length > 0 ? (
          <View style={styles.timeline}>
            {daySchedule.map((item, index) => (
              <View key={item.id} style={styles.timelineItem}>
                <View style={styles.timeColumn}>
                  <Text style={styles.timeText}>{item.startTime}</Text>
                </View>
                
                <TouchableOpacity 
                  style={[
                    styles.classCard, 
                    { backgroundColor: item.workspaceColor + '15', borderColor: item.workspaceColor + '40' },
                    item.isException && styles.classCardException
                  ]}
                  onPress={() => router.push(`/workspace/${item.workspaceId}`)}
                >
                  {/* Left Color Strip */}
                  <View style={[styles.colorStrip, { backgroundColor: item.workspaceColor }]} />
                  
                  <View style={styles.classCardContent}>
                    <View style={styles.classHeader}>
                      <Text style={[styles.classTitle, { color: item.workspaceColor }]}>{item.workspaceName}</Text>
                      {item.isException && (
                        <View style={[styles.exceptionBadge, { backgroundColor: item.workspaceColor + '30' }]}>
                          <Text style={[styles.exceptionText, { color: item.workspaceColor }]}>{item.exceptionAction}</Text>
                        </View>
                      )}
                    </View>
                    
                    <Text style={styles.classType}>{item.componentType.toUpperCase()}</Text>
                    
                    <View style={styles.classMeta}>
                      <View style={styles.metaItem}>
                        <Clock size={14} color={colors.light.textMuted} />
                        <Text style={styles.metaText}>{item.startTime} - {item.endTime}</Text>
                      </View>
                      <View style={styles.metaItem}>
                        <MapPin size={14} color={colors.light.textMuted} />
                        <Text style={styles.metaText}>{item.venueName || 'TBD'}</Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Free Day</Text>
            <Text style={styles.emptySub}>No classes scheduled.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.light.background },
  header: {
    backgroundColor: colors.light.surfaceElevated,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 2,
    zIndex: 10
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 20 },
  headerTitle: { fontSize: 32, fontWeight: '700', color: colors.light.text, fontFamily: 'Inter', letterSpacing: -0.5 },
  headerActions: { flexDirection: 'row', gap: 16 },
  iconBtn: { padding: 8, backgroundColor: colors.light.surface, borderRadius: 12 },

  weekNavigator: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 20 },
  navBtn: { padding: 8 },
  navCenterBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.light.surface, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, gap: 8 },
  weekLabel: { fontSize: 14, fontWeight: '600', color: colors.light.text, fontFamily: 'Inter' },

  dateStrip: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20 },
  dateBox: { alignItems: 'center', paddingVertical: 8, paddingHorizontal: 4, borderRadius: 16, width: 44 },
  dateBoxSelected: { backgroundColor: colors.light.primary },
  dayName: { fontSize: 12, fontWeight: '600', color: colors.light.textMuted, marginBottom: 8, fontFamily: 'Inter' },
  dayNameSelected: { color: 'rgba(255,255,255,0.8)' },
  dateCircle: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  dateCircleToday: { backgroundColor: colors.light.surface },
  dateNumber: { fontSize: 16, fontWeight: '700', color: colors.light.text, fontFamily: 'Inter' },
  dateNumberSelected: { color: '#FFF' },

  content: { flex: 1, backgroundColor: colors.light.surface },
  
  contextualTasksBanner: { 
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.light.warning + '15',
    margin: 16, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.light.warning + '40'
  },
  contextualIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: colors.light.warning + '30', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  contextualText: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.light.text, fontFamily: 'Inter' },

  timeline: { padding: 16, paddingTop: 8 },
  timelineItem: { flexDirection: 'row', marginBottom: 16 },
  timeColumn: { width: 56, alignItems: 'center', paddingTop: 16 },
  timeText: { fontSize: 13, fontWeight: '600', color: colors.light.textMuted, fontFamily: 'Inter' },

  classCard: { flex: 1, flexDirection: 'row', borderRadius: 16, overflow: 'hidden', borderWidth: 1 },
  classCardException: { borderStyle: 'dashed', borderWidth: 2 },
  colorStrip: { width: 6 },
  classCardContent: { flex: 1, padding: 16 },
  
  classHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  classTitle: { fontSize: 16, fontWeight: '700', fontFamily: 'Inter', flex: 1 },
  exceptionBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginLeft: 8 },
  exceptionText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', fontFamily: 'Inter' },
  
  classType: { fontSize: 12, fontWeight: '700', color: colors.light.textMuted, fontFamily: 'Inter', marginTop: 4, letterSpacing: 0.5 },
  
  classMeta: { flexDirection: 'row', marginTop: 12, gap: 16 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 13, color: colors.light.textMuted, fontFamily: 'Inter', fontWeight: '500' },

  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.light.text, fontFamily: 'Inter' },
  emptySub: { fontSize: 14, color: colors.light.textMuted, fontFamily: 'Inter', marginTop: 8 },
});
