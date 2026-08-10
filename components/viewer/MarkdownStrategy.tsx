import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, View, ActivityIndicator, Text } from 'react-native';
import Markdown from 'react-native-markdown-display';
import * as FileSystem from 'expo-file-system';
import { colors, spacing, typography } from '../../tokens';

export default function MarkdownStrategy({ uri }: { uri: string }) {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadFile = async () => {
      try {
        const text = await FileSystem.readAsStringAsync(uri);
        setContent(text);
      } catch (e) {
        console.error('Failed to load markdown file', e);
        setContent('Error loading document.');
      } finally {
        setLoading(false);
      }
    };
    loadFile();
  }, [uri]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.light.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Markdown style={markdownStyles}>
        {content}
      </Markdown>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.light.background,
  },
  content: {
    padding: spacing.xl,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  }
});

const markdownStyles = StyleSheet.create({
  body: {
    color: colors.light.text,
    fontSize: typography.fontSize.base,
    lineHeight: 24,
  },
  heading1: {
    color: colors.light.text,
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  }
});
