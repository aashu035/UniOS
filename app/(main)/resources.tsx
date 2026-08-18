import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Search, Folder, File, Download, Image as ImageIcon, FileText, LayoutGrid, FileType } from 'lucide-react-native';
import { colors } from '../../tokens';
import { db } from '../../core/db/client';
import { resources } from '../../domains/resource/model';
import { workspaces } from '../../domains/workspace/model';
import { eq, desc } from 'drizzle-orm';

interface ResourceView {
  id: number;
  title: string;
  type: string;
  sizeBytes?: number;
  workspaceName: string;
  workspaceColor: string;
  workspaceId: number;
}

export default function KnowledgeHubScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [allResources, setAllResources] = useState<ResourceView[]>([]);

  useEffect(() => {
    const loadResources = async () => {
      setLoading(true);
      try {
        const res = await db.select({
          id: resources.id,
          title: resources.title,
          type: resources.type,
          sizeBytes: resources.sizeBytes,
          workspaceName: workspaces.name,
          workspaceColor: workspaces.color,
          workspaceId: workspaces.id,
        })
        .from(resources)
        .leftJoin(workspaces, eq(resources.workspaceId, workspaces.id))
        .orderBy(desc(resources.createdAt))
        .all();

        setAllResources(res.map(r => ({
          ...r,
          type: r.type || 'unknown',
          sizeBytes: r.sizeBytes ?? undefined,
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
    loadResources();
  }, []);

  const getFileIcon = (type: string) => {
    if (type === 'pdf') return <FileType size={24} color="#EF4444" />;
    if (type === 'image') return <ImageIcon size={24} color="#3B82F6" />;
    if (type === 'doc') return <FileText size={24} color="#2563EB" />;
    return <File size={24} color={colors.light.textMuted} />;
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Create a unique set of courses that have resources for the "Folders" view
  const uniqueCourses = Array.from(new Set(allResources.map(r => r.workspaceId)))
    .map(id => {
      const sample = allResources.find(r => r.workspaceId === id);
      const count = allResources.filter(r => r.workspaceId === id).length;
      return { id, name: sample?.workspaceName || 'General', color: sample?.workspaceColor || colors.light.primary, count };
    });

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>Knowledge Hub</Text>
            <Text style={styles.headerSubtitle}>All your academic resources in one place.</Text>
          </View>
        </View>
        <View style={styles.searchBar}>
          <Search size={20} color={colors.light.textMuted} />
          <Text style={styles.searchPlaceholder}>Search notes, PDFs...</Text>
        </View>
      </View>

      <ScrollView style={styles.content}>
        {/* Categories (Squircles) */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll}>
          <View style={styles.categoriesRow}>
            <TouchableOpacity style={styles.categoryCard}>
              <View style={[styles.categoryIcon, { backgroundColor: colors.light.primary + '15' }]}>
                <LayoutGrid size={24} color={colors.light.primary} />
              </View>
              <Text style={styles.categoryText}>All Files</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.categoryCard}>
              <View style={[styles.categoryIcon, { backgroundColor: '#EF444415' }]}>
                <FileType size={24} color="#EF4444" />
              </View>
              <Text style={styles.categoryText}>PDFs</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.categoryCard}>
              <View style={[styles.categoryIcon, { backgroundColor: '#F59E0B15' }]}>
                <FileText size={24} color="#F59E0B" />
              </View>
              <Text style={styles.categoryText}>Notes</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.categoryCard}>
              <View style={[styles.categoryIcon, { backgroundColor: '#10B98115' }]}>
                <ImageIcon size={24} color="#10B981" />
              </View>
              <Text style={styles.categoryText}>Images</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        <Text style={styles.sectionTitle}>Course Folders</Text>
        <View style={styles.foldersGrid}>
          {uniqueCourses.map(course => (
            <TouchableOpacity 
              key={course.id} 
              style={[styles.folderCard, { borderColor: course.color + '30', backgroundColor: course.color + '05' }]}
              onPress={() => router.push(`/workspace/${course.id}`)}
            >
              <View style={styles.folderIconRow}>
                <Folder size={32} color={course.color} fill={course.color + '40'} />
              </View>
              <Text style={styles.folderTitle} numberOfLines={1}>{course.name}</Text>
              <Text style={styles.folderSubtitle}>{course.count} files</Text>
            </TouchableOpacity>
          ))}
          {uniqueCourses.length === 0 && !loading && (
             <View style={[styles.folderCard, { borderColor: colors.light.border, backgroundColor: colors.light.surface }]}>
               <Folder size={32} color={colors.light.textMuted} />
               <Text style={[styles.folderTitle, { color: colors.light.textMuted }]}>No Folders</Text>
             </View>
          )}
        </View>

        <Text style={styles.sectionTitle}>Recent Uploads</Text>
        {loading ? (
          <ActivityIndicator size="large" color={colors.light.accent} style={{ marginTop: 20 }} />
        ) : allResources.length > 0 ? (
          <View style={styles.recentList}>
            {allResources.slice(0, 5).map(res => (
              <TouchableOpacity key={res.id} style={styles.fileRow} onPress={() => router.push(`/workspace/${res.workspaceId}`)}>
                <View style={styles.fileIconWrapper}>
                  {getFileIcon(res.type)}
                </View>
                <View style={styles.fileInfo}>
                  <Text style={styles.fileTitle} numberOfLines={1}>{res.title}</Text>
                  <View style={styles.fileMeta}>
                    <Text style={[styles.fileSubject, { color: res.workspaceColor }]}>{res.workspaceName}</Text>
                    <Text style={styles.fileDot}>•</Text>
                    <Text style={styles.fileSize}>{formatSize(res.sizeBytes)}</Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.downloadBtn}>
                  <Download size={20} color={colors.light.textMuted} />
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No files yet.</Text>
            <Text style={styles.emptySub}>Tap the + button to add a new resource.</Text>
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
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  headerTitle: { fontSize: 32, fontWeight: '700', color: colors.light.text, fontFamily: 'Inter', letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 14, color: colors.light.textMuted, fontFamily: 'Inter', marginTop: 4 },
  
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.light.surfaceElevated, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.light.border, marginBottom: 8 },
  searchPlaceholder: { fontSize: 16, color: colors.light.textMuted, fontFamily: 'Inter', marginLeft: 12 },

  content: { flex: 1 },
  
  categoriesScroll: { paddingHorizontal: 20, marginTop: 24, marginBottom: 32 },
  categoriesRow: { flexDirection: 'row', gap: 16, paddingRight: 40 },
  categoryCard: { alignItems: 'center' },
  categoryIcon: { width: 64, height: 64, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  categoryText: { fontSize: 12, fontWeight: '600', color: colors.light.text, fontFamily: 'Inter' },

  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.light.text, fontFamily: 'Inter', paddingHorizontal: 20, marginBottom: 16 },

  foldersGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 12, marginBottom: 32 },
  folderCard: { width: '48%', backgroundColor: colors.light.surfaceElevated, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.light.border },
  folderIconRow: { marginBottom: 12 },
  folderTitle: { fontSize: 14, fontWeight: '600', color: colors.light.text, fontFamily: 'Inter', marginBottom: 4 },
  folderSubtitle: { fontSize: 12, color: colors.light.textMuted, fontFamily: 'Inter' },

  recentList: { paddingHorizontal: 20, paddingBottom: 40 },
  fileRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.light.surfaceElevated, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.light.border, marginBottom: 12 },
  fileIconWrapper: { width: 48, height: 48, borderRadius: 12, backgroundColor: colors.light.surface, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  fileInfo: { flex: 1 },
  fileTitle: { fontSize: 15, fontWeight: '600', color: colors.light.text, fontFamily: 'Inter', marginBottom: 4 },
  fileMeta: { flexDirection: 'row', alignItems: 'center' },
  fileSubject: { fontSize: 12, fontWeight: '600', fontFamily: 'Inter' },
  fileDot: { fontSize: 12, color: colors.light.textMuted, marginHorizontal: 6 },
  fileSize: { fontSize: 12, color: colors.light.textMuted, fontFamily: 'Inter' },
  downloadBtn: { padding: 8 },

  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.light.text, fontFamily: 'Inter' },
  emptySub: { fontSize: 14, color: colors.light.textMuted, fontFamily: 'Inter', marginTop: 8 },
});
