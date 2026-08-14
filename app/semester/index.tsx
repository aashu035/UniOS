import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Plus, Calendar, CheckCircle } from 'lucide-react-native';
import { colors, radius, spacing, typography } from '../../tokens';
import { useSemesters } from '../../domains/semester/hooks';

export default function SemesterList() {
  const router = useRouter();
  const { semesters, isLoading, updateSemester } = useSemesters();

  const handleSetCurrent = async (id: number) => {
    Alert.alert(
      "Set Active Semester",
      "Are you sure you want to make this the active semester?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Confirm", 
          onPress: () => updateSemester(id, { isActive: true })
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.back()} accessibilityLabel="Go back">
          <ArrowLeft size={24} color={colors.light.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Semesters</Text>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.push('/semester/add')} accessibilityLabel="Add semester">
          <Plus size={24} color={colors.light.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {isLoading ? (
          <Text style={styles.loadingText}>Loading...</Text>
        ) : semesters.length === 0 ? (
          <View style={styles.emptyState}>
            <Calendar size={48} color={colors.light.textMuted} style={styles.emptyIcon} />
            <Text style={styles.emptyTitle}>No semesters yet</Text>
            <Text style={styles.emptyDesc}>Add a semester to start tracking your SGPA.</Text>
          </View>
        ) : (
          semesters.map((sem) => (
            <TouchableOpacity 
              key={sem.id} 
              style={[styles.card, sem.isActive && styles.activeCard]}
              onPress={() => handleSetCurrent(sem.id)}
            >
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.semNumber}>Semester {sem.number}</Text>
                  {sem.name && <Text style={styles.semName}>{sem.name}</Text>}
                </View>
                {sem.isActive && (
                  <View style={styles.activeBadge}>
                    <CheckCircle size={14} color={colors.light.background} style={{ marginRight: 4 }} />
                    <Text style={styles.activeBadgeText}>Active</Text>
                  </View>
                )}
              </View>
              
              <View style={styles.cardDetails}>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Type</Text>
                  <Text style={styles.detailValue}>{sem.type === 'even' ? 'Even' : 'Odd'}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>SGPA</Text>
                  <Text style={styles.detailValue}>{sem.sgpa ? sem.sgpa.toFixed(2) : '--'}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.light.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.light.border },
  iconButton: { padding: spacing.sm },
  title: { fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold, color: colors.light.text },
  content: { padding: spacing.md },
  loadingText: { textAlign: 'center', marginTop: spacing.xl, color: colors.light.textMuted },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxl },
  emptyIcon: { marginBottom: spacing.md },
  emptyTitle: { fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold, color: colors.light.text, marginBottom: spacing.xs },
  emptyDesc: { fontSize: typography.fontSize.sm, color: colors.light.textMuted, textAlign: 'center' },
  card: { backgroundColor: colors.light.surface, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.light.border },
  activeCard: { borderColor: colors.light.primary, backgroundColor: `${colors.light.primary}05` },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md },
  semNumber: { fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold, color: colors.light.text },
  semName: { fontSize: typography.fontSize.sm, color: colors.light.textMuted, marginTop: 2 },
  activeBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.light.primary, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.full },
  activeBadgeText: { color: colors.light.background, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold },
  cardDetails: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.light.border, paddingTop: spacing.md, marginTop: spacing.sm },
  detailItem: { flex: 1 },
  detailLabel: { fontSize: typography.fontSize.xs, color: colors.light.textMuted, marginBottom: 2 },
  detailValue: { fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.semibold, color: colors.light.text },
});
