import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Home, Calendar, Plus, CheckSquare, Grid, BookOpen } from 'lucide-react-native';
import { colors } from '../../tokens';

const FABActionSheet = ({ visible, onClose, onAction }: { visible: boolean; onClose: () => void; onAction: (action: string) => void }) => {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Create</Text>
          <TouchableOpacity style={styles.actionBtn} onPress={() => onAction('course')}>
            <BookOpen color={colors.light.primary} size={20} />
            <Text style={styles.actionText}>Add Course</Text>
          </TouchableOpacity>
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

export default function MainLayout() {
  const [sheetVisible, setSheetVisible] = useState(false);
  const router = useRouter();

  const handleAction = (action: string) => {
    setSheetVisible(false);
    if (action === 'course') {
      router.push('/course/add');
    } else if (action === 'task') {
      router.push('/task/add');
    } else if (action === 'resource') {
      router.push('/resource/add');
    }
  };

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: colors.light.surfaceElevated,
            borderTopWidth: 0,
            elevation: 10,
            shadowColor: '#000',
            shadowOpacity: 0.05,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: -2 },
            height: 80,
            paddingBottom: 24,
            paddingTop: 12,
          },
          tabBarActiveTintColor: colors.light.accent,
          tabBarInactiveTintColor: colors.light.textMuted,
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '500',
            marginTop: 4,
          }
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
          name="planner"
          options={{
            title: 'Timetable',
            tabBarIcon: ({ color }) => <Calendar color={color} size={24} />,
          }}
        />
        <Tabs.Screen
          name="fab"
          options={{
            title: '',
            tabBarIcon: () => (
              <View style={styles.fabContainer}>
                <View style={styles.fab}>
                  <Plus color="#FFFFFF" size={24} />
                </View>
              </View>
            ),
          }}
          listeners={() => ({
            tabPress: (e) => {
              e.preventDefault();
              setSheetVisible(true);
            },
          })}
        />
        <Tabs.Screen
          name="tasks"
          options={{
            title: 'Tasks',
            tabBarIcon: ({ color }) => <CheckSquare color={color} size={24} />,
          }}
        />
        <Tabs.Screen
          name="more"
          options={{
            title: 'More',
            tabBarIcon: ({ color }) => <Grid color={color} size={24} />,
          }}
        />
        
        {/* Hidden screens that are still part of the main stack */}
        <Tabs.Screen name="workspaces" options={{ href: null }} />
        <Tabs.Screen name="tutor" options={{ href: null }} />
        <Tabs.Screen name="profile" options={{ href: null }} />
        <Tabs.Screen name="semester" options={{ href: null }} />
        <Tabs.Screen name="resources" options={{ href: null }} />
      </Tabs>

      <FABActionSheet 
        visible={sheetVisible} 
        onClose={() => setSheetVisible(false)} 
        onAction={handleAction} 
      />
    </>
  );
}

const styles = StyleSheet.create({
  fabContainer: {
    top: -15,
    justifyContent: 'center',
    alignItems: 'center',
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
