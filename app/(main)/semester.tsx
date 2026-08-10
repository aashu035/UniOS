import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '../../tokens';
import { useWorkspaces } from '../../domains/workspace/hooks';
import { AppCard } from '../../components/cards/AppCard';
import { SubjectCard } from '../../components/cards/SubjectCard';
import { useRouter } from 'expo-router';
import { SectionHeader } from '../../components/layout/SectionHeader';
import { IconButton } from '../../components/buttons/IconButton';
import { Plus } from 'lucide-react-native';

export default function Semester() {
  const { workspaces, isLoading } = useWorkspaces();
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>My Courses</Text>
        <IconButton 
          icon={<Plus size={24} color={colors.light.primary} />} 
          onPress={() => router.push('/course/add')} 
        />
      </View>
      <ScrollView contentContainerStyle={styles.container}>
        {isLoading ? (
          <Text style={styles.emptyText}>Loading...</Text>
        ) : workspaces.length > 0 ? (
          workspaces.map(ws => (
            <SubjectCard 
              key={ws.id}
              title={ws.name}
              code={ws.code || 'Course'}
              attendancePercentage={ws.targetAttendance || 75}
              onPress={() => router.push(`/workspace/${ws.id}`)}
            />
          ))
        ) : (
          <AppCard padding="lg" style={styles.emptyCard}>
            <Text style={styles.emptyText}>No courses found.</Text>
            <Text style={styles.emptySubtext}>Tap the + button to add a new course.</Text>
          </AppCard>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.light.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  container: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  title: { fontSize: typography.fontSize.xl, fontWeight: typography.fontWeight.bold, color: colors.light.text },
  emptyCard: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxl },
  emptyText: { color: colors.light.text, fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.semibold },
  emptySubtext: { color: colors.light.textMuted, fontSize: typography.fontSize.sm, marginTop: spacing.sm },
});
