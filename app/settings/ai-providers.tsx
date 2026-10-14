import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Save } from 'lucide-react-native';
import { colors, radius, spacing, typography } from '../../tokens';
import { GeminiKey } from '../../core/settings/aiProviders';

export default function AIProvidersSettings() {
  const router = useRouter();
  const [key, setKey] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function loadKeys() {
      try {
        setKey((await GeminiKey.get()) ?? '');
      } catch (err) {
        console.error('Failed to load API keys:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadKeys();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await GeminiKey.save(key);
      Alert.alert('Saved', key.trim() ? 'The timetable scanner can now read photos.' : 'Key removed.');
      router.back();
    } catch (err) {
      console.error('Failed to save keys:', err);
      Alert.alert('Error', 'Failed to save API keys. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.light.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.back()} accessibilityLabel="Go back">
          <ArrowLeft size={24} color={colors.light.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Timetable scanner</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.description}>
          The timetable scanner reads a photo of your timetable with Google Gemini. Paste your free Gemini API key from aistudio.google.com. It is stored only on this phone and sent only to Google when you scan.
        </Text>

        <View style={styles.field}>
          <Text style={styles.label}>Gemini API key</Text>
          <TextInput
            style={styles.input}
            placeholder="AIzaSy..."
            placeholderTextColor={colors.light.textMuted}
            value={key}
            onChangeText={setKey}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={[styles.saveButton, isSaving && styles.disabled]} onPress={handleSave} disabled={isSaving}>
          <Save size={20} color={colors.dark.text} style={styles.saveIcon} />
          <Text style={styles.saveText}>{isSaving ? 'Saving…' : 'Save'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.light.background },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.light.border },
  iconButton: { padding: spacing.sm },
  headerSpacer: { width: 40 },
  title: { fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold, color: colors.light.text },
  content: { padding: spacing.xl },
  description: { fontSize: typography.fontSize.base, color: colors.light.textMuted, marginBottom: spacing.xxl, lineHeight: 22 },
  field: { marginBottom: spacing.lg },
  label: { fontSize: typography.fontSize.sm, color: colors.light.text, fontWeight: typography.fontWeight.semibold, marginBottom: spacing.sm },
  input: { minHeight: 52, borderWidth: 1, borderColor: colors.light.border, backgroundColor: colors.light.surface, borderRadius: radius.lg, paddingHorizontal: spacing.lg, color: colors.light.text, fontSize: typography.fontSize.base },
  footer: { padding: spacing.xl, borderTopWidth: 1, borderTopColor: colors.light.border },
  saveButton: { minHeight: 52, borderRadius: radius.xl, backgroundColor: colors.light.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  saveIcon: { marginRight: spacing.sm },
  saveText: { color: colors.dark.text, fontWeight: typography.fontWeight.bold, fontSize: typography.fontSize.base },
  disabled: { opacity: 0.5 },
});
