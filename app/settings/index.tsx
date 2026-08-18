import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, Database, Bot, Key, FileText, Smartphone } from 'lucide-react-native';
import { colors } from '../../tokens';

export default function SettingsScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color={colors.light.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.container}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/settings/data')}>
            <Database size={20} color={colors.light.textMuted} />
            <Text style={styles.menuText}>Data Management</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Artificial Intelligence</Text>
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/settings/ai')}>
            <Bot size={20} color={colors.light.textMuted} />
            <Text style={styles.menuText}>Cloud AI Companion</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/settings/ai-providers')}>
            <Key size={20} color={colors.light.textMuted} />
            <Text style={styles.menuText}>AI API Providers</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/settings/pairing')}>
            <Smartphone size={20} color={colors.light.textMuted} />
            <Text style={styles.menuText}>Local Tutor Pairing</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/settings/ai-guide')}>
            <FileText size={20} color={colors.light.textMuted} />
            <Text style={styles.menuText}>AI Usage Guide</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.light.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.light.text,
  },
  container: {
    flex: 1,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.light.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  menuText: {
    fontSize: 16,
    color: colors.light.text,
    marginLeft: 16,
    fontWeight: '500',
  },
});
