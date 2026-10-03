import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Tabs } from 'expo-router';
import { UniTabBar } from '../../components/uni/TabBar';
import { colors } from '../../tokens';

/**
 * Tabs: Home (today), Timetable (schedule), Tasks (work), More (menu), with the
 * create button in the middle of the bar. The pre-redesign tab screens stay
 * routable but hidden until they are removed.
 */
export default function MainLayout() {
  return (
    <Tabs
      tabBar={(props) => <UniTabBar {...props} />}
      backBehavior="history"
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="today" options={{ title: 'Home' }} />
      <Tabs.Screen name="schedule" options={{ title: 'Timetable' }} />
      <Tabs.Screen name="work" options={{ title: 'Tasks' }} />
      <Tabs.Screen name="menu" options={{ title: 'More' }} />

      {/* Pre-redesign screens, reachable by URL only. */}
      <Tabs.Screen name="planner" options={{ href: null }} />
      <Tabs.Screen name="more" options={{ href: null }} />
      <Tabs.Screen name="fab" options={{ href: null }} />
      <Tabs.Screen name="workspaces" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
      <Tabs.Screen name="semester" options={{ href: null }} />
      <Tabs.Screen name="resources" options={{ href: null }} />
    </Tabs>
  );
}

export function ErrorBoundary({ error, retry }: import('expo-router').ErrorBoundaryProps) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.light.background }}>
      <Text style={{ fontSize: 18, color: colors.light.text, marginBottom: 12 }}>Something went wrong in the UI.</Text>
      <Text style={{ color: colors.light.danger, marginBottom: 24, paddingHorizontal: 20, textAlign: 'center' }}>
        {error.message}
      </Text>
      <TouchableOpacity
        onPress={retry}
        style={{ backgroundColor: colors.light.accent, padding: 16, borderRadius: 12 }}>
        <Text style={{ color: '#FFFFFF', fontWeight: 'bold' }}>Restart App</Text>
      </TouchableOpacity>
    </View>
  );
}
