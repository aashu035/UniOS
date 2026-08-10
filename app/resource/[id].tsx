import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, typography, radius } from '../../tokens';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { db } from '../../core/db/client';
import { resources } from '../../domains/resource/model';
import { eq } from 'drizzle-orm';
import { ArrowLeft } from 'lucide-react-native';
import { Skeleton } from '../../components/ui/Skeleton';

export default function ResourceDetail() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [resource, setResource] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadResource() {
      try {
        const [res] = await db.select().from(resources).where(eq(resources.id, parseInt(id as string, 10)));
        setResource(res);
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    }
    loadResource();
  }, [id]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconButton} accessibilityLabel="Go back">
            <ArrowLeft color={colors.light.text} size={24} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Loading...</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={{ padding: spacing.xl }}>
          <Skeleton height={200} borderRadius={radius.xl} style={{ marginBottom: spacing.md }} />
          <Skeleton height={32} borderRadius={radius.sm} width="60%" style={{ marginBottom: spacing.md }} />
          <Skeleton height={150} borderRadius={radius.xl} />
        </View>
      </SafeAreaView>
    );
  }

  if (!resource) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconButton} accessibilityLabel="Go back">
            <ArrowLeft color={colors.light.text} size={24} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Not Found</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={{ padding: spacing.xl, alignItems: 'center' }}>
          <Text style={{ color: colors.light.textMuted }}>Resource not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconButton} accessibilityLabel="Go back">
          <ArrowLeft color={colors.light.text} size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{resource.title}</Text>
        <View style={styles.headerSpacer} />
      </View>
      
      <ScrollView>
        <View style={{ padding: spacing.xl }}>
          <View style={styles.card}>
            {resource.textContent ? (
              <Text style={styles.textContent}>{resource.textContent}</Text>
            ) : (
              <Text style={{ color: colors.light.textMuted }}>This resource has no text content.</Text>
            )}
          </View>
        </View>
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
  card: {
    backgroundColor: colors.light.surfaceElevated,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
    minHeight: 200,
  },
  textContent: {
    fontSize: typography.fontSize.base,
    color: colors.light.text,
    lineHeight: 24,
  }
});
