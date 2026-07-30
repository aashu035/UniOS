import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Slot, useLocalSearchParams, useRouter, useSegments, usePathname } from 'expo-router';
import { AppScaffold } from '../../../components/layout/AppScaffold';
import { PageHeader } from '../../../components/layout/PageHeader';
import { IconButton } from '../../../components/buttons/IconButton';
import { TopTabBar, TabItem } from '../../../components/layout/TopTabBar';
import { ChevronLeft, MoreHorizontal } from 'lucide-react-native';
import { colors, spacing } from '../../../tokens';

const WORKSPACE_TABS: TabItem[] = [
  { key: 'index', label: 'Overview' },
  { key: 'knowledge', label: 'Knowledge Hub' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'insights', label: 'Insights' },
];

export default function WorkspaceLayout() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const segments = useSegments();
  const pathname = usePathname();

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

  // Mock subject name based on id for now
  const subjectName = id === '1' ? 'Data Structures' : 'Operating Systems';

  return (
    <AppScaffold>
      {/* Pinned Workspace Header */}
      <PageHeader 
        title={subjectName}
        leftAction={
          <IconButton 
            icon={<ChevronLeft size={24} color={colors.light.text} />} 
            onPress={() => router.back()} 
          />
        }
        rightAction={
          <IconButton 
            icon={<MoreHorizontal size={24} color={colors.light.text} />} 
          />
        }
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
