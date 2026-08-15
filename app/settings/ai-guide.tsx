import React from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, typography, radius } from '../../tokens';
import { useRouter } from 'expo-router';
import { ArrowLeft, Server, Smartphone, Key } from 'lucide-react-native';

export default function AIGuide() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
          <ArrowLeft color={colors.light.text} size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>AI Architecture Guide</Text>
        <View style={styles.headerSpacer} />
      </View>
      
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        
        <Text style={styles.title}>How UniOS AI Works</Text>
        <Text style={styles.paragraph}>
          UniOS offers two completely different ways to power its AI features. You can use Cloud Providers (like Google Gemini) directly from your phone, OR you can host a Local AI Companion on your laptop for maximum privacy.
        </Text>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Key size={24} color={colors.light.primary} />
            <Text style={styles.cardTitle}>Method 1: Cloud APIs (Recommended)</Text>
          </View>
          <Text style={styles.paragraph}>
            This uses your own API keys for services like Google Gemini or OpenAI. The phone securely stores your key, and talks directly to the cloud. 
          </Text>
          <Text style={styles.bullet}>• Instant setup</Text>
          <Text style={styles.bullet}>• Zero battery drain</Text>
          <Text style={styles.bullet}>• Access to massive models (Gemini 1.5 Pro)</Text>
          <Text style={styles.paragraph}>
            Configure this in <Text style={{fontWeight: 'bold'}}>Settings → AI Providers</Text>.
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Server size={24} color={colors.light.primary} />
            <Text style={styles.cardTitle}>Method 2: Local AI Companion</Text>
          </View>
          <Text style={styles.paragraph}>
            This method is 100% offline. Because Large Language Models (LLMs) are huge and require complex C++ binaries that melt phone batteries, UniOS uses your Laptop as the brain.
          </Text>
          <Text style={styles.step}>Step 1: Install Ollama on your laptop.</Text>
          <Text style={styles.step}>Step 2: Download a model (e.g., `ollama pull qwen:8b`).</Text>
          <Text style={styles.step}>Step 3: Run the UniOS Python Companion on your laptop.</Text>
          <Text style={styles.step}>Step 4: Connect your phone to your laptop's IP address.</Text>
          <Text style={styles.paragraph}>
            Your phone remains the primary data store, but it asks your laptop to do the heavy thinking over your local WiFi.
          </Text>
        </View>

        <Text style={styles.title}>Why not run it directly on the phone?</Text>
        <Text style={styles.paragraph}>
          Even with 12GB of RAM, running an LLM completely offline on a mobile device requires installing massive C++ Native modules. These modules:
        </Text>
        <Text style={styles.bullet}>1. Increase the app download size to several gigabytes.</Text>
        <Text style={styles.bullet}>2. Drain the phone battery extremely quickly.</Text>
        <Text style={styles.bullet}>3. Cannot be easily tested in the Expo Go app.</Text>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.light.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.light.border,
  },
  iconButton: { padding: spacing.sm },
  headerTitle: { fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold, color: colors.light.text },
  headerSpacer: { width: 40 },
  container: { flex: 1 },
  content: { padding: spacing.xl },
  title: { fontSize: typography.fontSize.xl, fontWeight: typography.fontWeight.bold, color: colors.light.text, marginBottom: spacing.md, marginTop: spacing.lg },
  paragraph: { fontSize: typography.fontSize.base, color: colors.light.textMuted, lineHeight: 22, marginBottom: spacing.md },
  card: { backgroundColor: colors.light.surface, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.light.border },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm, gap: spacing.sm },
  cardTitle: { fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold, color: colors.light.text },
  bullet: { fontSize: typography.fontSize.base, color: colors.light.textMuted, lineHeight: 22, marginLeft: spacing.sm, marginBottom: 4 },
  step: { fontSize: typography.fontSize.base, color: colors.light.text, fontWeight: typography.fontWeight.semibold, lineHeight: 22, marginBottom: 4 },
});
