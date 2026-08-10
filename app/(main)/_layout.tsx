import { View, Text, TouchableOpacity } from 'react-native';
import { Tabs } from 'expo-router';
import { Home, BookOpen, Calendar, User, LayoutGrid } from 'lucide-react-native';
import { colors } from '../../tokens';

export default function MainLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.light.surfaceElevated,
          borderTopWidth: 1,
          borderTopColor: colors.light.border,
          elevation: 0,
          height: 60,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: colors.light.primary,
        tabBarInactiveTintColor: colors.light.textMuted,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Home color={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="semester"
        options={{
          title: 'Semester',
          tabBarIcon: ({ color }) => <LayoutGrid color={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="workspaces"
        options={{
          title: 'Workspaces',
          tabBarIcon: ({ color }) => <BookOpen color={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="planner"
        options={{
          title: 'Planner',
          tabBarIcon: ({ color }) => <Calendar color={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <User color={color} size={24} />,
        }}
      />
      
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
        style={{ backgroundColor: colors.light.primary, padding: 16, borderRadius: 12 }}>
        <Text style={{ color: colors.dark.text, fontWeight: 'bold' }}>Restart App</Text>
      </TouchableOpacity>
    </View>
  );
}
