import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppScaffold } from '../components/layout/AppScaffold';
import { PageContainer } from '../components/layout/PageContainer';
import { IconButton } from '../components/buttons/IconButton';
import { EmptyState } from '../components/layout/EmptyState';
import { FileText, Search as SearchIcon, X } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { colors, radius, spacing, typography } from '../tokens';
import { expoDb } from '../core/db/client';
import { Skeleton } from '../components/ui/Skeleton';

type SearchResult = { id: number; workspaceId: number | null; title: string; subtitle: string; kind: 'Course' | 'Task' | 'Resource' };

export default function SearchModal() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const term = query.trim();
    if (!term) {
      setResults([]);
      return;
    }
    let active = true;
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const pattern = `%${term}%`;
        const [courses, taskRows, resourceRows] = await Promise.all([
          expoDb.getAllAsync<Omit<SearchResult, 'kind' | 'workspaceId'> & { workspaceId?: number | null }>('SELECT id, name AS title, COALESCE(code, \'Course\') AS subtitle FROM workspaces WHERE name LIKE ? OR code LIKE ? LIMIT 10', pattern, pattern),
          expoDb.getAllAsync<Omit<SearchResult, 'kind'> & { workspaceId: number | null }>('SELECT id, workspace_id AS workspaceId, title, COALESCE(due_date, \'No due date\') AS subtitle FROM tasks WHERE title LIKE ? LIMIT 10', pattern),
          expoDb.getAllAsync<Omit<SearchResult, 'kind'> & { workspaceId: number | null }>('SELECT id, workspace_id AS workspaceId, title, type AS subtitle FROM resources WHERE title LIKE ? LIMIT 10', pattern),
        ]);
        if (active) setResults([
          ...courses.map(row => ({ id: row.id, workspaceId: row.id, title: row.title, subtitle: row.subtitle, kind: 'Course' as const })),
          ...taskRows.map(row => ({ ...row, kind: 'Task' as const })),
          ...resourceRows.map(row => ({ ...row, kind: 'Resource' as const })),
        ]);
      } catch (error) {
        console.error('Search failed', error);
        if (active) setResults([]);
      } finally {
        if (active) setIsSearching(false);
      }
    }, 180);
    return () => { active = false; clearTimeout(timer); };
  }, [query]);

  return (
    <AppScaffold>
      <View style={styles.header}>
        <View style={styles.searchBar}>
          <SearchIcon size={20} color={colors.light.textMuted} />
          <TextInput style={styles.input} placeholder="Search courses, tasks, resources…" placeholderTextColor={colors.light.textMuted} autoFocus value={query} onChangeText={setQuery} returnKeyType="search" />
          {isSearching && <Skeleton height={20} width={20} borderRadius={radius.full} />}
        </View>
        <IconButton icon={<X size={24} color={colors.light.text} />} onPress={() => router.back()} accessibilityLabel="Close search" />
      </View>
      <PageContainer>
        {!query.trim() ? <EmptyState icon={<SearchIcon size={48} color={colors.light.textMuted} />} title="Search your UniOS" description="Find courses, tasks, and resources saved on this device." /> : results.length === 0 && !isSearching ? <EmptyState icon={<SearchIcon size={48} color={colors.light.textMuted} />} title="No matches" description="Try a course code, task title, or resource name." /> : <View style={styles.results}>{results.map(result => <Pressable key={`${result.kind}-${result.id}`} style={styles.result} onPress={() => result.workspaceId && router.push(`/workspace/${result.workspaceId}`)}><View style={styles.resultIcon}><FileText size={20} color={colors.light.primary} /></View><View style={styles.resultText}><Text style={styles.resultTitle} numberOfLines={1}>{result.title}</Text><Text style={styles.resultSubtitle} numberOfLines={1}>{result.kind} · {result.subtitle}</Text></View></Pressable>)}</View>}
      </PageContainer>
    </AppScaffold>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm }, searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.light.surfaceElevated, borderRadius: radius.full, paddingHorizontal: spacing.lg, height: 48, gap: spacing.sm, borderWidth: 1, borderColor: colors.light.border }, input: { flex: 1, fontSize: typography.fontSize.base, color: colors.light.text }, results: { gap: spacing.sm, paddingTop: spacing.sm }, result: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.light.surface, borderWidth: 1, borderColor: colors.light.border }, resultIcon: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md }, resultText: { flex: 1 }, resultTitle: { fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.semibold, color: colors.light.text }, resultSubtitle: { fontSize: typography.fontSize.sm, color: colors.light.textMuted, marginTop: 2 },
});
