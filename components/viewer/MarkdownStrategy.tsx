import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, View, ActivityIndicator, Text } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { markdownParser, MAX_MARKDOWN_BYTES } from './markdownParser';
import * as FileSystem from 'expo-file-system/legacy';
import { colors, spacing, typography } from '../../tokens';

/** Markdown is parsed with markdownParser (see there why); other text is shown as is. */
export default function MarkdownStrategy({ uri, plain = false }: { uri: string; plain?: boolean }) {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadFile = async () => {
      try {
        // Use legacy filesystem API for Expo SDK 54+ compatibility
        let text = '';
        if (FileSystem.readAsStringAsync) {
          text = await FileSystem.readAsStringAsync(uri);
        } else {
          // Fallback if imported from legacy in future
          const FileSystemLegacy = require('expo-file-system/legacy');
          text = await FileSystemLegacy.readAsStringAsync(uri);
        }
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
      {plain || content.length > MAX_MARKDOWN_BYTES ? (
        <Text selectable style={markdownStyles.body}>{content}</Text>
      ) : (
        <Markdown style={markdownStyles} markdownit={markdownParser}>
          {content}
        </Markdown>
      )}
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
