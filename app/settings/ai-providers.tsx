import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Save } from 'lucide-react-native';
import { colors, radius, spacing, typography } from '../../tokens';
import { AIProviderKeysStore, AIProviderKeys, AIProvider } from '../../core/settings/aiProviders';

export default function AIProvidersSettings() {
  const router = useRouter();
  const [keys, setKeys] = useState<AIProviderKeys>({
    gemini: null,
    openai: null,
    anthropic: null,
    openrouter: null,
    nvidia: null,
    numtron: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function loadKeys() {
      try {
        const storedKeys = await AIProviderKeysStore.getKeys();
        setKeys(storedKeys);
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
      await AIProviderKeysStore.saveKey('gemini', keys.gemini);
      await AIProviderKeysStore.saveKey('openai', keys.openai);
      await AIProviderKeysStore.saveKey('anthropic', keys.anthropic);
      await AIProviderKeysStore.saveKey('openrouter', keys.openrouter);
      await AIProviderKeysStore.saveKey('nvidia', keys.nvidia);
      await AIProviderKeysStore.saveKey('numtron', keys.numtron);
      
      Alert.alert('Keys Saved', 'Your AI provider API keys have been saved securely on your device.');
      router.back();
    } catch (err) {
      console.error('Failed to save keys:', err);
      Alert.alert('Error', 'Failed to save API keys. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const updateKey = (provider: AIProvider, value: string) => {
    setKeys((prev) => ({ ...prev, [provider]: value }));
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
        <Text style={styles.title}>AI Provider Keys</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.description}>
          Add your API keys below to enable local AI capabilities (like the Timetable AI Parser). Keys are stored securely on your device using Expo SecureStore and are never sent to our servers.
        </Text>

        <ProviderField label="Google Gemini API Key" provider="gemini" value={keys.gemini || ''} onChange={(val) => updateKey('gemini', val)} placeholder="AIzaSy..." />
        <ProviderField label="OpenAI API Key" provider="openai" value={keys.openai || ''} onChange={(val) => updateKey('openai', val)} placeholder="sk-..." />
        <ProviderField label="Anthropic API Key" provider="anthropic" value={keys.anthropic || ''} onChange={(val) => updateKey('anthropic', val)} placeholder="sk-ant-..." />
        <ProviderField label="OpenRouter API Key" provider="openrouter" value={keys.openrouter || ''} onChange={(val) => updateKey('openrouter', val)} placeholder="sk-or-v1-..." />
        <ProviderField label="NVIDIA NIM API Key" provider="nvidia" value={keys.nvidia || ''} onChange={(val) => updateKey('nvidia', val)} placeholder="nvapi-..." />
        <ProviderField label="Numtron API Key" provider="numtron" value={keys.numtron || ''} onChange={(val) => updateKey('numtron', val)} placeholder="num-..." />

      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={[styles.saveButton, isSaving && styles.disabled]} onPress={handleSave} disabled={isSaving}>
          <Save size={20} color={colors.dark.text} style={styles.saveIcon} />
          <Text style={styles.saveText}>{isSaving ? 'Saving…' : 'Save Keys'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function ProviderField({ label, value, onChange, placeholder, provider }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; provider: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={colors.light.textMuted}
        value={value}
        onChangeText={onChange}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
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
