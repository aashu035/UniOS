import React, { useCallback, useState } from 'react';
import { View, StyleSheet, Text, Modal, Pressable, TouchableOpacity } from 'react-native';
import { Slot, useFocusEffect, useLocalSearchParams, useRouter, useSegments, usePathname } from 'expo-router';
import { AppScaffold } from '../../../components/layout/AppScaffold';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Button } from '../../../components/buttons/Button';
import { TopTabBar, TabItem } from '../../../components/layout/TopTabBar';
import { ChevronLeft, Settings2 } from 'lucide-react-native';
import { colors, spacing } from '../../../tokens';
import { useWorkspace } from '../../../domains/workspace/hooks';
import { Plus, CheckSquare, Grid } from 'lucide-react-native';

const FABActionSheet = ({ visible, onClose, onAction }: { visible: boolean; onClose: () => void; onAction: (action: string) => void }) => {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Create in Course</Text>
          <TouchableOpacity style={styles.actionBtn} onPress={() => onAction('task')}>
            <CheckSquare color={colors.light.primary} size={20} />
            <Text style={styles.actionText}>Add Task</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => onAction('resource')}>
            <Grid color={colors.light.primary} size={20} />
            <Text style={styles.actionText}>Add Resource</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  );
};

const WORKSPACE_TABS: TabItem[] = [
  { key: 'index', label: 'Overview' },
  { key: 'knowledge', label: 'Knowledge Hub' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'attendance', label: 'Attendance' },
];

export default function WorkspaceLayout() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const segments = useSegments();
  const pathname = usePathname();
  const workspaceId = Number(Array.isArray(id) ? id[0] : id);
  const { workspaceData, refreshWorkspace } = useWorkspace(Number.isFinite(workspaceId) ? workspaceId : 0);
  const [sheetVisible, setSheetVisible] = useState(false);

  useFocusEffect(useCallback(() => {
    refreshWorkspace();
  }, [refreshWorkspace]));

  // Determine active tab based on the current segment
  // segments for /workspace/1/knowledge would be ['workspace', '[id]', 'knowledge']
  // segments for /workspace/1 would be ['workspace', '[id]'] (which implies 'index')
  const currentSegment = segments[segments.length - 1];
  let activeTabKey = 'index';
  
  if (currentSegment !== '[id]' && WORKSPACE_TABS.some(t => t.key === currentSegment)) {
    activeTabKey = currentSegment;
  } else if (pathname.endsWith(`/${id}`) || pathname.endsWith(`/${id}/`)) {
    activeTabKey = 'index';
  }

  const handleTabChange = (key: string) => {
    // If key is 'index', navigate to /workspace/[id]
    // Otherwise navigate to /workspace/[id]/[key]
    if (key === 'index') {
      router.replace(`/workspace/${id}`);
    } else {
      router.replace(`/workspace/${id}/${key}`);
    }
  };

  const handleAction = (action: string) => {
    setSheetVisible(false);
    if (action === 'task') {
      router.push({ pathname: '/task/add', params: { workspaceId: String(id) } });
    } else if (action === 'resource') {
      router.push({ pathname: '/resource/add', params: { workspaceId: String(id) } });
    }
  };

  const subjectName = workspaceData?.workspace?.name ?? 'Course';

  return (
    <AppScaffold>
      {/* Pinned Workspace Header */}
      <PageHeader 
        title={subjectName}
        leftAction={
          <Button variant="icon" 
            icon={<ChevronLeft size={24} color={colors.light.text} />} 
            onPress={() => router.back()} 
          />
        }
        rightAction={<Button variant="icon" icon={<Settings2 size={22} color={colors.light.text} />} onPress={() => router.push({ pathname: '/course/edit', params: { id: String(id) } })} accessibilityLabel="Edit course" />}
      />
      
      {/* Custom Horizontal Top Tab Bar */}
      <TopTabBar 
        tabs={WORKSPACE_TABS} 
        activeTab={activeTabKey} 
        onTabChange={handleTabChange} 
      />

      {/* Child routes get rendered here */}
      <View style={styles.content}>
        <Slot />
      </View>

      {/* Context-aware FAB */}
      <View style={styles.fabContainer}>
        <TouchableOpacity style={styles.fab} onPress={() => setSheetVisible(true)}>
          <Plus color="#FFFFFF" size={24} />
        </TouchableOpacity>
      </View>

      <FABActionSheet 
        visible={sheetVisible} 
        onClose={() => setSheetVisible(false)} 
        onAction={handleAction} 
      />
    </AppScaffold>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    backgroundColor: colors.light.background,
  },
  fabContainer: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    zIndex: 100,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.light.accent,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.light.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.light.surfaceElevated,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 48,
  },
  sheetTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.light.textMuted,
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  actionText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.light.primary,
    marginLeft: 12,
  },
});
