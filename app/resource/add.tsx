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
  const [files, setFiles] = useState<{name: string, uri: string, extension: string}[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (files.length > 0) {
      setType('file');
    } else if (uri.startsWith('http://') || uri.startsWith('https://')) {
      setType('link');
    } else if (!uri && textContent) {
      setType('note');
    }
  }, [uri, textContent, files]);

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (result.canceled) {
        return;
      }

      const pickedFiles = result.assets.map(file => ({
        name: file.name,
        uri: file.uri,
        extension: file.name.split('.').pop() || 'unknown',
      }));
      
      setFiles(prev => [...prev, ...pickedFiles]);
      
      if (!title && pickedFiles.length === 1) {
        setTitle(pickedFiles[0].name);
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to pick file');
    }
  };

  const handleSave = async () => {
    if (!title && files.length === 0) {
      Alert.alert('Error', 'Please enter a title or select files');
      return;
    }
    if (!workspaceId) {
      Alert.alert('Error', 'Workspace ID is missing');
      return;
    }

    try {
      setIsSubmitting(true);
      
      if (files.length > 0) {
        // Save multiple files
        for (const file of files) {
          const computedHash = await FileManager.generateFileHash(file.uri);
          const { eq } = require('drizzle-orm');
          const existingResource = await db.select().from(resources).where(eq(resources.fileHash, computedHash)).limit(1);
          
          let existingHashFilename: string | undefined;
          if (existingResource.length > 0 && existingResource[0].uri) {
            existingHashFilename = existingResource[0].uri;
          }

          const { filename, hash, sizeBytes } = await FileManager.saveFile(file.uri, file.extension, existingHashFilename);
          
          await db.insert(resources).values({
            workspaceId: parseInt(workspaceId, 10),
            title: files.length === 1 && title ? title : file.name, // Use custom title if only 1 file
            uri: filename,
            textContent: '',
            type: 'file',
            thumbnailUrl: null,
            fileHash: hash,
            sizeBytes: sizeBytes,
          });
        }
      } else {
        // Save single note or link
        await db.insert(resources).values({
          workspaceId: parseInt(workspaceId, 10),
          title,
          uri: uri,
          textContent,
          type: type,
          thumbnailUrl: null,
          fileHash: null,
          sizeBytes: null,
        });
      }

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
        {files.length > 0 && (
          <View style={{ gap: spacing.sm, marginBottom: spacing.md }}>
            {files.map((f, i) => (
              <View key={i} style={styles.fileAttachment}>
                <Text style={styles.fileName} numberOfLines={1}>{f.name}</Text>
                <TouchableOpacity onPress={() => setFiles(prev => prev.filter((_, idx) => idx !== i))} style={styles.removeFileBtn}>
                  <X color={colors.light.textMuted} size={20} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
        <TouchableOpacity style={styles.pickFileBtn} onPress={handlePickFile}>
          <FilePlus color={colors.light.primary} size={24} style={{ marginRight: spacing.sm }} />
          <Text style={styles.pickFileText}>{files.length > 0 ? "Add More Files" : "Select Document, Video, or Image"}</Text>
        </TouchableOpacity>

        <Text style={styles.label}>URL / Link (Optional)</Text>
        <TextInput 
          style={styles.input}
          placeholder="e.g. https://reactnative.dev" 
          placeholderTextColor={colors.light.textMuted}
          value={uri}
          onChangeText={setUri}
          editable={files.length === 0}
        />

        <Text style={styles.label}>Note Content (Optional)</Text>
        <TextInput 
          style={[styles.input, styles.textArea]}
          placeholder="Write your notes here..." 
          placeholderTextColor={colors.light.textMuted}
          value={textContent}
          onChangeText={setTextContent}
          multiline
          editable={files.length === 0}
        />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.button, ((!title.trim() && files.length === 0) || isSubmitting) && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={(!title.trim() && files.length === 0) || isSubmitting}
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
