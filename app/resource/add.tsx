import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Text, Alert, TextInput, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, typography, radius } from '../../tokens';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { db } from '../../core/db/client';
import { resources } from '../../domains/resource/model';
import { ArrowLeft, Save, FilePlus, X } from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import { FileManager } from '../../core/fs/FileManager';

export default function AddResource() {
  const router = useRouter();
  const { workspaceId: initialWorkspaceId } = useLocalSearchParams();
  
  const [workspaceId, setWorkspaceId] = useState(initialWorkspaceId as string || '');
  const [title, setTitle] = useState('');
  const [uri, setUri] = useState('');
  const [textContent, setTextContent] = useState('');
  const [type, setType] = useState('note'); // 'note', 'link', 'file'
  const [fileDetails, setFileDetails] = useState<{name: string, uri: string, extension: string} | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-detect if it's a link
  useEffect(() => {
    if (fileDetails) {
      setType('file');
    } else if (uri.startsWith('http://') || uri.startsWith('https://')) {
      setType('link');
    } else if (!uri && textContent) {
      setType('note');
    }
  }, [uri, textContent, fileDetails]);

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const file = result.assets[0];
      const extension = file.name.split('.').pop() || 'unknown';
      setFileDetails({
        name: file.name,
        uri: file.uri,
        extension,
      });
      if (!title) {
        setTitle(file.name);
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to pick file');
    }
  };

  const handleSave = async () => {
    if (!title) {
      Alert.alert('Error', 'Please enter a title');
      return;
    }
    if (!workspaceId) {
      Alert.alert('Error', 'Workspace ID is missing');
      return;
    }

    try {
      setIsSubmitting(true);
      
      let finalUri = uri;
      let finalHash: string | null = null;
      let finalSize: number | null = null;
      let finalType = type;

      if (fileDetails) {
        // Hash the file first for deduplication check
        const computedHash = await FileManager.generateFileHash(fileDetails.uri);
        
        // Check if hash already exists in DB
        const { eq } = require('drizzle-orm');
        const existingResource = await db.select().from(resources).where(eq(resources.fileHash, computedHash)).limit(1);
        
        let existingHashFilename: string | undefined;
        if (existingResource.length > 0 && existingResource[0].uri) {
          existingHashFilename = existingResource[0].uri;
        }

        // Handle file offloading via FileManager (will skip physical copy if existingHashFilename is passed)
        const { filename, hash, sizeBytes } = await FileManager.saveFile(fileDetails.uri, fileDetails.extension, existingHashFilename);
        finalUri = filename;
        finalHash = hash;
        finalSize = sizeBytes;
      }
      
      await db.insert(resources).values({
        workspaceId: parseInt(workspaceId, 10),
        title,
        uri: finalUri,
        textContent,
        type: finalType,
        thumbnailUrl: null, // Removed external network fetch for privacy
        fileHash: finalHash,
        sizeBytes: finalSize,
      });

      router.back();
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to save resource');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconButton} accessibilityLabel="Go back">
          <ArrowLeft color={colors.light.text} size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Note / Link</Text>
        <View style={styles.headerSpacer} />
      </View>
      
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Title *</Text>
        <TextInput 
          style={styles.input}
          placeholder="e.g. React Native Documentation" 
          placeholderTextColor={colors.light.textMuted}
          value={title}
          onChangeText={setTitle}
        />

        <Text style={styles.label}>File Attachment</Text>
        {fileDetails ? (
          <View style={styles.fileAttachment}>
            <Text style={styles.fileName} numberOfLines={1}>{fileDetails.name}</Text>
            <TouchableOpacity onPress={() => setFileDetails(null)} style={styles.removeFileBtn}>
              <X color={colors.light.textMuted} size={20} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.pickFileBtn} onPress={handlePickFile}>
            <FilePlus color={colors.light.primary} size={24} style={{ marginRight: spacing.sm }} />
            <Text style={styles.pickFileText}>Select Document, Video, or Image</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.label}>URL / Link (Optional)</Text>
        <TextInput 
          style={styles.input}
          placeholder="e.g. https://reactnative.dev" 
          placeholderTextColor={colors.light.textMuted}
          value={uri}
          onChangeText={setUri}
          editable={!fileDetails}
        />

        <Text style={styles.label}>Note Content (Optional)</Text>
        <TextInput 
          style={[styles.input, styles.textArea]}
          placeholder="Write your notes here..." 
          placeholderTextColor={colors.light.textMuted}
          value={textContent}
          onChangeText={setTextContent}
          multiline
          editable={!fileDetails}
        />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.button, (!title.trim() || isSubmitting) && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={!title.trim() || isSubmitting}
        >
          <Save color={colors.dark.text} size={20} style={styles.saveIcon} />
          <Text style={styles.buttonText}>{isSubmitting ? 'Saving...' : 'Save Resource'}</Text>
        </TouchableOpacity>
      </View>
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
  label: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.light.text, marginTop: spacing.lg, marginBottom: spacing.sm },
  input: { backgroundColor: colors.light.surface, borderRadius: radius.lg, padding: spacing.lg, fontSize: typography.fontSize.base, color: colors.light.text, borderWidth: 1, borderColor: colors.light.border },
  textArea: { height: 100, textAlignVertical: 'top' },
  helpText: { fontSize: typography.fontSize.sm, color: colors.light.textMuted, fontStyle: 'italic', marginTop: spacing.sm },
  footer: { padding: spacing.xl, borderTopWidth: 1, borderTopColor: colors.light.border },
  button: { backgroundColor: colors.light.primary, borderRadius: radius.xl, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  buttonDisabled: { opacity: 0.5 },
  saveIcon: { marginRight: spacing.sm },
  buttonText: { color: colors.dark.text, fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.bold },
  fileAttachment: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.light.surface, padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.light.primary },
  fileName: { flex: 1, color: colors.light.text, fontSize: typography.fontSize.base },
  removeFileBtn: { padding: spacing.xs },
  pickFileBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.light.surface, padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.light.border, borderStyle: 'dashed' },
  pickFileText: { color: colors.light.primary, fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.semibold },
});
