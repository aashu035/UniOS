import React, { useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Image, Alert, ActivityIndicator, ScrollView, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Upload, CheckCircle2, Zap } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { colors, radius, spacing, typography } from '../../tokens';
import { Button } from '../../components/buttons/Button';
import { AITimetableService } from '../../domains/workspace/aiService';
import { ParsedClassSession } from '../../core/ai/timetableParser';

export default function AITimetableSetup() {
  const router = useRouter();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedClassSession[] | null>(null);
  const [batchCode, setBatchCode] = useState<string>('CSE-2');

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission required', 'We need access to your photos to upload a timetable.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0].uri) {
      setImageUri(result.assets[0].uri);
      setParsedData(null); // reset if new image picked
    }
  };

  const processImage = async () => {
    if (!imageUri) return;
    setIsProcessing(true);
    try {
      const sessions = await AITimetableService.importTimetable(imageUri, batchCode);
      setParsedData(sessions);
      Alert.alert('Success', 'Timetable imported successfully! You can find the events in your Calendar and Subjects list.');
    } catch (error: any) {
      console.error('AI Timetable error:', error);
      Alert.alert('Error', error?.message || 'Could not parse the timetable image. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const finish = () => {
    router.replace('/(main)/home');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={colors.light.text} />
        </TouchableOpacity>
        <Text style={styles.title}>AI Timetable</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {!parsedData ? (
          <>
            <View style={styles.heroSection}>
              <View style={styles.iconWrapper}>
                <Zap size={40} color={colors.light.primary} />
              </View>
              <Text style={styles.heroTitle}>Automate your Schedule</Text>
              <Text style={styles.heroSubtitle}>
                Upload a photo of your timetable. UniOS will automatically extract your classes, labs, and tutorials.
              </Text>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Your Batch / Section Code</Text>
              <Text style={styles.inputHelp}>Used to pick the correct class when slots are split (e.g., CSE-2)</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.textInput}
                  value={batchCode}
                  onChangeText={setBatchCode}
                  placeholder="e.g. CSE-2"
                  placeholderTextColor={colors.light.textMuted}
                />
              </View>
            </View>

            <TouchableOpacity style={styles.uploadArea} onPress={pickImage}>
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={styles.imagePreview} resizeMode="cover" />
              ) : (
                <View style={styles.uploadPlaceholder}>
                  <Upload size={32} color={colors.light.textMuted} />
                  <Text style={styles.uploadText}>Tap to select image</Text>
                </View>
              )}
            </TouchableOpacity>

            {imageUri && (
              <Button
                variant="primary"
                label={isProcessing ? "Processing (this takes a moment)..." : "Scan Timetable"}
                onPress={processImage}
                loading={isProcessing}
                disabled={isProcessing}
                style={styles.processButton}
              />
            )}
          </>
        ) : (
          <View style={styles.successSection}>
            <CheckCircle2 size={64} color={colors.light.success} style={styles.successIcon} />
            <Text style={styles.successTitle}>Timetable Imported!</Text>
            <Text style={styles.successSubtitle}>
              We found and imported {parsedData.length} class sessions.
            </Text>

            <View style={styles.previewList}>
              {parsedData.slice(0, 5).map((session, idx) => (
                <View key={idx} style={styles.previewItem}>
                  <Text style={styles.previewDay}>{session.day} • {session.startTime}</Text>
                  <Text style={styles.previewSubject}>{session.subjectCode} ({session.type})</Text>
                </View>
              ))}
              {parsedData.length > 5 && (
                <Text style={styles.moreText}>+ {parsedData.length - 5} more sessions...</Text>
              )}
            </View>

            <Button variant="primary" label="Go to Dashboard" onPress={finish} style={styles.processButton} />
          </View>
        )}
      </ScrollView>
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
  heroSection: { alignItems: 'center', marginBottom: spacing.xxl, marginTop: spacing.md },
  iconWrapper: { width: 80, height: 80, borderRadius: 40, backgroundColor: `${colors.light.primary}20`, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  heroTitle: { fontSize: typography.fontSize['2xl'], fontWeight: typography.fontWeight.bold, color: colors.light.text, marginBottom: spacing.sm, textAlign: 'center' },
  heroSubtitle: { fontSize: typography.fontSize.base, color: colors.light.textMuted, textAlign: 'center', lineHeight: 22 },
  uploadArea: { width: '100%', height: 240, borderRadius: radius.xl, borderWidth: 2, borderColor: colors.light.border, borderStyle: 'dashed', overflow: 'hidden', marginBottom: spacing.xl },
  inputContainer: { marginBottom: spacing.xl, width: '100%' },
  inputLabel: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.light.text, marginBottom: spacing.xs },
  inputHelp: { fontSize: typography.fontSize.xs, color: colors.light.textMuted, marginBottom: spacing.sm },
  inputWrapper: { height: 50, borderRadius: radius.lg, backgroundColor: colors.light.surface, borderWidth: 1, borderColor: colors.light.border, justifyContent: 'center' },
  textInput: { flex: 1, paddingHorizontal: spacing.md, fontSize: typography.fontSize.base, color: colors.light.text },
  uploadPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.light.surface },
  uploadText: { marginTop: spacing.md, color: colors.light.textMuted, fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.medium },
  imagePreview: { width: '100%', height: '100%' },
  processButton: { width: '100%' },
  successSection: { alignItems: 'center', marginTop: spacing.xxl },
  successIcon: { marginBottom: spacing.lg },
  successTitle: { fontSize: typography.fontSize.xl, fontWeight: typography.fontWeight.bold, color: colors.light.text, marginBottom: spacing.sm },
  successSubtitle: { fontSize: typography.fontSize.base, color: colors.light.textMuted, marginBottom: spacing.xl },
  previewList: { width: '100%', backgroundColor: colors.light.surface, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.xl },
  previewItem: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.light.border },
  previewDay: { fontSize: typography.fontSize.sm, color: colors.light.textMuted, marginBottom: 2 },
  previewSubject: { fontSize: typography.fontSize.base, color: colors.light.text, fontWeight: typography.fontWeight.semibold },
  moreText: { textAlign: 'center', color: colors.light.textMuted, marginTop: spacing.md, fontStyle: 'italic' }
});
