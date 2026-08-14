import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TextInput, Text, Alert } from 'react-native';
import { AppScaffold } from '../../components/layout/AppScaffold';
import { PageContainer } from '../../components/layout/PageContainer';
import { Button } from '../../components/buttons/Button';
import { colors, spacing, typography, radius } from '../../tokens';
import { useRouter } from 'expo-router';
import { Sparkles, Key } from 'lucide-react-native';
import * as SecureStore from 'expo-secure-store';

export default function CloudAISettings() {
  const router = useRouter();
  const [apiKey, setApiKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadKey();
  }, []);

  const loadKey = async () => {
    try {
      const key = await SecureStore.getItemAsync('gemini_api_key');
      if (key) {
        setApiKey(key);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const saveKey = async () => {
    if (!apiKey.trim()) {
      Alert.alert('Missing Key', 'Please enter a valid Gemini API Key.');
      return;
    }
    
    setIsSaving(true);
    try {
      await SecureStore.setItemAsync('gemini_api_key', apiKey.trim());
      Alert.alert('Success', 'Cloud AI key saved successfully.');
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Could not save the API key securely.');
    } finally {
      setIsSaving(false);
    }
  };

  const clearKey = async () => {
    try {
      await SecureStore.deleteItemAsync('gemini_api_key');
      setApiKey('');
      Alert.alert('Removed', 'Cloud AI key removed.');
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <AppScaffold>
      <PageContainer>
        <View style={styles.header}>
          <Sparkles size={48} color={colors.light.primary} />
          <Text style={styles.title}>Cloud AI Scheduler</Text>
          <Text style={styles.subtitle}>
            Enter your Google Gemini API key to enable intelligent scheduling and natural language processing.
          </Text>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Gemini API Key</Text>
          <View style={styles.inputWrapper}>
            <Key size={20} color={colors.light.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="AIzaSy..."
              value={apiKey}
              onChangeText={setApiKey}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />
          </View>
        </View>

        <View style={styles.actions}>
          <Button variant="primary" 
            label={isSaving ? "Saving..." : "Save Key"} 
            onPress={saveKey} 
            disabled={!apiKey || isSaving}
          />
          {!!apiKey && (
            <Button variant="secondary" 
              label="Remove Key" 
              onPress={clearKey} 
            />
          )}
          <Button variant="secondary" 
            label="Use Local Laptop AI instead" 
            onPress={() => router.push('/settings/pairing')} 
          />
          <Button variant="text" 
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
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.light.text,
    marginBottom: spacing.xs,
  },
  formGroup: {
    marginBottom: spacing.xl,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.light.surface,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    minHeight: 52,
  },
  inputIcon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: typography.fontSize.base,
    color: colors.light.text,
  },
  actions: {
    gap: spacing.md,
  }
});
