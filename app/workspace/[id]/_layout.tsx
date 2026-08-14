import React, { useCallback } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Slot, useFocusEffect, useLocalSearchParams, useRouter, useSegments, usePathname } from 'expo-router';
import { AppScaffold } from '../../../components/layout/AppScaffold';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Button } from '../../../components/buttons/Button';
import { TopTabBar, TabItem } from '../../../components/layout/TopTabBar';
import { ChevronLeft, Settings2 } from 'lucide-react-native';
import { colors, spacing } from '../../../tokens';
import { useWorkspace } from '../../../domains/workspace/hooks';

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
    </AppScaffold>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    backgroundColor: colors.light.background,
  }
});
