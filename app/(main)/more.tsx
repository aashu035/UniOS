import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { BookOpen, CheckCircle, Folder, User, Settings as SettingsIcon, ChevronRight } from 'lucide-react-native';
import { colors } from '../../tokens';

export default function MoreScreen() {
  const router = useRouter();

  const Section = ({ title, children }: { title: string, children: React.ReactNode }) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionContent}>
        {children}
      </View>
    </View>
  );

  const ListItem = ({ icon: Icon, title, onPress, isLast = false }: any) => (
    <TouchableOpacity style={[styles.listItem, !isLast && styles.borderBottom]} onPress={onPress}>
      <View style={styles.iconContainer}>
        <Icon size={20} color={colors.light.primary} />
      </View>
      <Text style={styles.itemTitle}>{title}</Text>
      <ChevronRight size={20} color={colors.light.textMuted} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container}>
        <Text style={styles.headerTitle}>More</Text>

        <Section title="ACADEMICS">
          <ListItem 
            icon={BookOpen} 
            title="Courses & Semester" 
            onPress={() => router.push('/(main)/semester')} 
          />
          <ListItem 
            icon={CheckCircle} 
            title="Attendance" 
            onPress={() => router.push('/course/attendance')} 
          />
          <ListItem 
            icon={Folder} 
            title="Knowledge Hub" 
            onPress={() => router.push('/(main)/resources')} 
            isLast={true}
          />
        </Section>

        <Section title="PERSONAL">
          <ListItem 
            icon={User} 
            title="Profile" 
            onPress={() => router.push('/(main)/profile')} 
            isLast={true}
          />
        </Section>

        <Section title="APP">
          <ListItem 
            icon={SettingsIcon} 
            title="Settings" 
            onPress={() => router.push('/settings')} 
            isLast={true}
          />
        </Section>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.light.background,
  },
  container: {
    flex: 1,
    padding: 16,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.light.text,
    fontFamily: 'Inter',
    marginBottom: 24,
    marginTop: 16,
    letterSpacing: -0.5,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.light.textMuted,
    fontFamily: 'Inter',
    marginBottom: 8,
    marginLeft: 4,
    letterSpacing: 1,
  },
  sectionContent: {
    backgroundColor: colors.light.surfaceElevated,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.light.surfaceElevated,
  },
  borderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.light.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  itemTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: colors.light.text,
    fontFamily: 'Inter',
  },
});
