import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Save } from 'lucide-react-native';
import { colors, radius, spacing, typography } from '../../tokens';
import { useSemesters } from '../../domains/semester/hooks';

export default function AddSemester() {
  const router = useRouter();
  const { addSemester } = useSemesters();
  
  const [number, setNumber] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState('odd');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    const num = parseInt(number, 10);
    if (isNaN(num) || num < 1 || num > 12) {
      Alert.alert('Invalid Number', 'Please enter a valid semester number (1-12).');
      return;
    }

    setIsSaving(true);
    try {
      await addSemester({
        number: num,
        name: name.trim() || undefined,
        type: type,
      });
      router.back();
    } catch (error) {
      console.error('Error saving semester:', error);
      Alert.alert('Error', 'Could not save the semester. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.back()} accessibilityLabel="Go back">
          <ArrowLeft size={24} color={colors.light.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Add Semester</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Semester Number *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 5"
          placeholderTextColor={colors.light.textMuted}
          value={number}
          onChangeText={setNumber}
          keyboardType="number-pad"
          autoFocus
        />

        <Text style={styles.label}>Custom Name (Optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Fall 2026"
          placeholderTextColor={colors.light.textMuted}
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.label}>Semester Type</Text>
        <View style={styles.typeSelector}>
          <TouchableOpacity 
            style={[styles.typeButton, type === 'odd' && styles.typeButtonActive]}
            onPress={() => setType('odd')}
          >
            <Text style={[styles.typeText, type === 'odd' && styles.typeTextActive]}>Odd</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.typeButton, type === 'even' && styles.typeButtonActive]}
            onPress={() => setType('even')}
          >
            <Text style={[styles.typeText, type === 'even' && styles.typeTextActive]}>Even</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.saveButton, isSaving && styles.disabled]} 
          onPress={handleSave} 
          disabled={isSaving}
        >
          <Save size={20} color={colors.dark.text} style={styles.saveIcon} />
          <Text style={styles.saveText}>{isSaving ? 'Saving…' : 'Save Semester'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.light.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.light.border },
  iconButton: { padding: spacing.sm },
  headerSpacer: { width: 40 },
  title: { fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold, color: colors.light.text },
  content: { padding: spacing.xl },
  label: { fontSize: typography.fontSize.sm, color: colors.light.text, fontWeight: typography.fontWeight.semibold, marginBottom: spacing.sm, marginTop: spacing.md },
  input: { minHeight: 52, borderWidth: 1, borderColor: colors.light.border, backgroundColor: colors.light.surface, borderRadius: radius.lg, paddingHorizontal: spacing.lg, color: colors.light.text, fontSize: typography.fontSize.base },
  typeSelector: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xs },
  typeButton: { flex: 1, paddingVertical: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: colors.light.border, borderRadius: radius.md, backgroundColor: colors.light.surface },
  typeButtonActive: { borderColor: colors.light.primary, backgroundColor: `${colors.light.primary}10` },
  typeText: { fontSize: typography.fontSize.base, color: colors.light.text, fontWeight: typography.fontWeight.medium },
  typeTextActive: { color: colors.light.primary, fontWeight: typography.fontWeight.bold },
  footer: { padding: spacing.xl, borderTopWidth: 1, borderTopColor: colors.light.border }, 
  saveButton: { minHeight: 52, borderRadius: radius.xl, backgroundColor: colors.light.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }, 
  saveIcon: { marginRight: spacing.sm }, 
  saveText: { color: colors.dark.text, fontWeight: typography.fontWeight.bold, fontSize: typography.fontSize.base }, 
  disabled: { opacity: 0.5 },
});
