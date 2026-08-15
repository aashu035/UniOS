import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Search, Filter, CheckCircle, Circle, Clock } from 'lucide-react-native';
import { colors } from '../../tokens';
import { db } from '../../core/db/client';
import { tasks } from '../../domains/task/model';
import { workspaces } from '../../domains/workspace/model';
import { eq, asc, desc } from 'drizzle-orm';

type FilterState = 'all' | 'due_soon' | 'upcoming' | 'completed';

interface TaskView {
  id: number;
  title: string;
  dueDate: string | null;
  status: string;
  workspaceName: string;
  workspaceColor: string;
  workspaceId: number;
}

export default function TasksScreen() {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<FilterState>('all');
  const [loading, setLoading] = useState(true);
  const [allTasks, setAllTasks] = useState<TaskView[]>([]);

  useEffect(() => {
    const loadTasks = async () => {
      setLoading(true);
      try {
        const res = await db.select({
          id: tasks.id,
          title: tasks.title,
          dueDate: tasks.dueDate,
          status: tasks.status,
          workspaceName: workspaces.name,
          workspaceColor: workspaces.color,
          workspaceId: workspaces.id,
        })
        .from(tasks)
        .leftJoin(workspaces, eq(tasks.workspaceId, workspaces.id))
        .orderBy(asc(tasks.dueDate))
        .all();

        // Fallback for nulls
        setAllTasks(res.map(r => ({
          ...r,
          workspaceName: r.workspaceName || 'General',
          workspaceColor: r.workspaceColor || colors.light.textMuted,
          workspaceId: r.workspaceId || 0,
        })));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadTasks();
  }, []);

  const getFilteredTasks = () => {
    const today = new Date().toISOString().split('T')[0];
    
    switch (activeFilter) {
      case 'completed': return allTasks.filter(t => t.status === 'completed');
      case 'due_soon': return allTasks.filter(t => t.status !== 'completed' && t.dueDate && t.dueDate <= today);
      case 'upcoming': return allTasks.filter(t => t.status !== 'completed' && t.dueDate && t.dueDate > today);
      default: return allTasks.filter(t => t.status !== 'completed'); // 'all' shows pending
    }
  };

  const filteredTasks = getFilteredTasks();

  const toggleTask = async (id: number, currentStatus: string) => {
    // In a real app, we would await TaskRepository.updateTask
    // Here we optimistically update UI
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    setAllTasks(allTasks.map(t => t.id === id ? { ...t, status: newStatus } : t));
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>Tasks</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.iconBtn}><Search size={20} color={colors.light.text} /></TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn}><Filter size={20} color={colors.light.text} /></TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.tabBg}>
            <TouchableOpacity style={[styles.tabBtn, activeFilter === 'all' && styles.tabBtnActive]} onPress={() => setActiveFilter('all')}>
              <Text style={[styles.tabText, activeFilter === 'all' && styles.tabTextActive]}>All Pending</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tabBtn, activeFilter === 'due_soon' && styles.tabBtnActive]} onPress={() => setActiveFilter('due_soon')}>
              <Text style={[styles.tabText, activeFilter === 'due_soon' && styles.tabTextActive]}>Due Soon</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tabBtn, activeFilter === 'upcoming' && styles.tabBtnActive]} onPress={() => setActiveFilter('upcoming')}>
              <Text style={[styles.tabText, activeFilter === 'upcoming' && styles.tabTextActive]}>Upcoming</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tabBtn, activeFilter === 'completed' && styles.tabBtnActive]} onPress={() => setActiveFilter('completed')}>
              <Text style={[styles.tabText, activeFilter === 'completed' && styles.tabTextActive]}>Completed</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{allTasks.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statValue, { color: colors.light.danger }]}>
            {allTasks.filter(t => t.status !== 'completed' && t.dueDate && t.dueDate <= new Date().toISOString().split('T')[0]).length}
          </Text>
          <Text style={styles.statLabel}>Due Soon</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statValue, { color: colors.light.success }]}>
            {allTasks.filter(t => t.status === 'completed').length}
          </Text>
          <Text style={styles.statLabel}>Done</Text>
        </View>
      </View>

      <ScrollView style={styles.content}>
        {loading ? (
          <ActivityIndicator size="large" color={colors.light.accent} style={{ marginTop: 40 }} />
        ) : filteredTasks.length > 0 ? (
          <View style={styles.taskList}>
            {filteredTasks.map(task => (
              <TouchableOpacity key={task.id} style={styles.taskCard} onPress={() => router.push(`/workspace/${task.workspaceId}`)}>
                <TouchableOpacity style={styles.checkbox} onPress={() => toggleTask(task.id, task.status)}>
                  {task.status === 'completed' ? (
                    <CheckCircle size={24} color={colors.light.success} />
                  ) : (
                    <Circle size={24} color={colors.light.border} />
                  )}
                </TouchableOpacity>
                <View style={styles.taskContent}>
                  <Text style={[styles.taskTitle, task.status === 'completed' && styles.taskTitleDone]}>{task.title}</Text>
                  <View style={styles.taskMeta}>
                    <View style={[styles.subjectBadge, { backgroundColor: task.workspaceColor + '15' }]}>
                      <Text style={[styles.subjectBadgeText, { color: task.workspaceColor }]}>{task.workspaceName}</Text>
                    </View>
                    {task.dueDate && (
                      <View style={styles.dueDateBadge}>
                        <Clock size={12} color={colors.light.textMuted} />
                        <Text style={styles.dueDateText}>{task.dueDate}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Nothing due.</Text>
            <Text style={styles.emptySub}>Enjoy the empty day.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.light.background },
  header: {
    backgroundColor: colors.light.background,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20 },
  headerTitle: { fontSize: 32, fontWeight: '700', color: colors.light.text, fontFamily: 'Inter', letterSpacing: -0.5 },
  headerActions: { flexDirection: 'row', gap: 16 },
  iconBtn: { padding: 8, backgroundColor: colors.light.surface, borderRadius: 12 },

  tabContainer: { paddingHorizontal: 20, marginBottom: 20 },
  tabBg: { flexDirection: 'row', gap: 8 },
  tabBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: colors.light.surface, borderWidth: 1, borderColor: colors.light.border },
  tabBtnActive: { backgroundColor: colors.light.text, borderColor: colors.light.text },
  tabText: { fontSize: 14, fontWeight: '600', color: colors.light.textMuted, fontFamily: 'Inter' },
  tabTextActive: { color: colors.light.background },

  statsRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 12, marginBottom: 24 },
  statBox: { flex: 1, backgroundColor: colors.light.surfaceElevated, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.light.border, alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '700', color: colors.light.text, fontFamily: 'Inter', marginBottom: 4 },
  statLabel: { fontSize: 12, fontWeight: '600', color: colors.light.textMuted, fontFamily: 'Inter' },

  content: { flex: 1 },
  taskList: { paddingHorizontal: 20, gap: 12, paddingBottom: 40 },
  
  taskCard: { 
    flexDirection: 'row', alignItems: 'flex-start', padding: 16, 
    backgroundColor: colors.light.surfaceElevated, borderRadius: 16, 
    borderWidth: 1, borderColor: colors.light.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 2
  },
  checkbox: { marginRight: 16, marginTop: 2 },
  taskContent: { flex: 1 },
  taskTitle: { fontSize: 16, fontWeight: '500', color: colors.light.text, fontFamily: 'Inter', marginBottom: 12, lineHeight: 22 },
  taskTitleDone: { color: colors.light.textMuted, textDecorationLine: 'line-through' },
  
  taskMeta: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  subjectBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  subjectBadgeText: { fontSize: 11, fontWeight: '700', fontFamily: 'Inter' },
  
  dueDateBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dueDateText: { fontSize: 12, color: colors.light.textMuted, fontFamily: 'Inter', fontWeight: '500' },

  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.light.text, fontFamily: 'Inter' },
  emptySub: { fontSize: 14, color: colors.light.textMuted, fontFamily: 'Inter', marginTop: 8 },
});
