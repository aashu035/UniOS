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
      
      {/* Hide the old tabs from the navigation bar while they are being removed/replaced */}
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="courses" options={{ href: null }} />
      <Tabs.Screen name="tasks" options={{ href: null }} />
      <Tabs.Screen name="timetable" options={{ href: null }} />
      <Tabs.Screen name="more" options={{ href: null }} />
    </Tabs>
  );
}
