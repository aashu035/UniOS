import React, { useState } from 'react';
import { View, StyleSheet, Alert, Text } from 'react-native';
import { AppScaffold } from '../../components/layout/AppScaffold';
import { PageContainer } from '../../components/layout/PageContainer';
import { Button } from '../../components/buttons/Button';
import { colors, spacing, typography, radius } from '../../tokens';
import { useRouter } from 'expo-router';
import { Database, AlertTriangle } from 'lucide-react-native';
import { db } from '../../core/db/client';
import { students, semesters, workspaces, tasks, resources, attendance, calendarEvents, aiConnections, faculty, venues } from '../../core/db/schema';
import * as Haptics from 'expo-haptics';

export default function DataManagement() {
  const router = useRouter();
  const [isClearing, setIsClearing] = useState(false);

  const clearAllData = async () => {
    Alert.alert(
      "Clear All Data",
      "Are you sure you want to delete all data? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setIsClearing(true);
            try {
              // Delete in order to avoid FK constraint issues if any, though ON DELETE CASCADE helps
              await db.delete(tasks);
              await db.delete(resources);
              await db.delete(attendance);
              await db.delete(calendarEvents);
              await db.delete(workspaces);
              await db.delete(semesters);
              await db.delete(aiConnections);
              await db.delete(students);
              // Reference tables are not reachable through cascades; clean them explicitly
              await db.delete(faculty);
              await db.delete(venues);
              
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert("Success", "All data has been cleared.");
              router.replace('/');
            } catch (e) {
              console.error('Failed to clear data:', e);
              Alert.alert("Error", "Could not clear all data.");
            } finally {
              setIsClearing(false);
            }
          }
        }
      ]
    );
  };

  return (
    <AppScaffold>
      <PageContainer>
        <View style={styles.header}>
          <Database size={48} color={colors.light.primary} />
          <Text style={styles.title}>Data Management</Text>
          <Text style={styles.subtitle}>
            Manage your local app data.
          </Text>
        </View>

        <View style={{ backgroundColor: `${colors.light.danger}20`, padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.xl, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <AlertTriangle color={colors.light.danger} size={24} />
          <Text style={{ color: colors.light.danger, fontWeight: typography.fontWeight.semibold, flex: 1 }}>
            Warning: These actions are destructive and cannot be undone.
          </Text>
        </View>

        <View style={styles.actions}>
          <Button 
            variant="secondary" 
            label={isClearing ? "Clearing Data..." : "Clear All App Data"} 
            onPress={clearAllData} 
            disabled={isClearing}
            style={styles.dangerButton}
          />
          <Button 
            variant="secondary" 
            label="Back to Profile" 
            onPress={() => router.back()} 
          />
        </View>
      </PageContainer>
    </AppScaffold>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
    marginTop: spacing.xl,
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  subtitle: {
    textAlign: 'center',
    color: colors.light.textMuted,
    paddingHorizontal: spacing.xl,
  },
  actions: {
    gap: spacing.md,
  },
  dangerButton: {
    borderColor: `${colors.light.danger}50`,
  }
});
