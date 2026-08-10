import React, { Suspense } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { colors, spacing, typography, radius } from '../../tokens';
import { FileManager } from '../../core/fs/FileManager';
import { Skeleton } from '../../components/ui/Skeleton';
import * as IntentLauncher from 'expo-intent-launcher';
import * as FileSystem from 'expo-file-system';

// Lazy load heavy native components to prevent monolithic memory usage
const PdfStrategy = React.lazy(() => import('../../components/viewer/PdfStrategy'));
const VideoStrategy = React.lazy(() => import('../../components/viewer/VideoStrategy'));
const MarkdownStrategy = React.lazy(() => import('../../components/viewer/MarkdownStrategy'));
const ImageStrategy = React.lazy(() => import('../../components/viewer/ImageStrategy'));

export default function ResourceViewer() {
  const router = useRouter();
  const { filename, title } = useLocalSearchParams<{ filename: string; title: string }>();

  if (!filename) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>No filename provided.</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const absoluteUri = FileManager.getAbsolutePath(filename);
  const extension = filename.split('.').pop()?.toLowerCase();

  const renderStrategy = () => {
    switch (extension) {
      case 'pdf':
        return <PdfStrategy uri={absoluteUri} />;
      case 'mp4':
      case 'mov':
      case 'avi':
      case 'mkv':
        return <VideoStrategy uri={absoluteUri} />;
      case 'md':
      case 'txt':
      case 'json':
      case 'csv':
        return <MarkdownStrategy uri={absoluteUri} />;
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'webp':
      case 'gif':
        return <ImageStrategy uri={absoluteUri} />;
      case 'doc':
      case 'docx':
      case 'ppt':
      case 'pptx':
      case 'xls':
      case 'xlsx':
      case 'epub':
        return renderIntentStrategy(absoluteUri, extension);
      default:
        return (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Unsupported file type: {extension}</Text>
          </View>
        );
    }
  };

  const renderIntentStrategy = (uri: string, ext: string) => {
    return (
      <View style={styles.intentContainer}>
        <Text style={styles.intentText}>
          This file format ({ext.toUpperCase()}) requires an external app to view.
        </Text>
        <TouchableOpacity 
          style={styles.intentBtn}
          onPress={async () => {
            try {
              if (Platform.OS === 'android') {
                let mimeType = '*/*';
                if (ext === 'doc' || ext === 'docx') mimeType = 'application/msword';
                if (ext === 'ppt' || ext === 'pptx') mimeType = 'application/vnd.ms-powerpoint';
                if (ext === 'xls' || ext === 'xlsx') mimeType = 'application/vnd.ms-excel';
                if (ext === 'epub') mimeType = 'application/epub+zip';

                // Use expo-file-system's getContentUriAsync to safely share to other apps
                const contentUri = await FileSystem.getContentUriAsync(uri);

                await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
                  data: contentUri,
                  type: mimeType,
                  flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
                });
              } else {
                const Sharing = require('expo-sharing');
                if (await Sharing.isAvailableAsync()) {
                  await Sharing.shareAsync(uri);
                } else {
                  Alert.alert('Error', 'Sharing is not available on this device');
                }
              }
            } catch (e) {
              Alert.alert('Error', 'Could not open file. Do you have a compatible app installed?');
              console.error(e);
            }
          }}
        >
          <Text style={styles.intentBtnText}>Open in External App</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconButton} accessibilityLabel="Go back">
          <ArrowLeft color={colors.light.text} size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{title || 'Document Viewer'}</Text>
        <View style={styles.headerSpacer} />
      </View>
      
      <View style={styles.viewerContainer}>
        <Suspense fallback={
          <View style={styles.loadingContainer}>
            <Skeleton height={200} borderRadius={radius.lg} style={{ marginBottom: spacing.md, width: '90%' }} />
            <Skeleton height={40} borderRadius={radius.md} width="60%" />
          </View>
        }>
          {renderStrategy()}
        </Suspense>
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
  headerTitle: { flex: 1, fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold, color: colors.light.text, textAlign: 'center' },
  headerSpacer: { width: 40 },
  viewerContainer: { flex: 1, backgroundColor: colors.dark.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: spacing.md, color: colors.light.textMuted },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  errorText: { color: colors.light.text, fontSize: typography.fontSize.lg, marginBottom: spacing.lg, textAlign: 'center' },
  backBtn: { backgroundColor: colors.light.primary, padding: spacing.md, borderRadius: radius.md },
  backBtnText: { color: colors.dark.text, fontWeight: typography.fontWeight.bold },
  intentContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  intentText: { color: colors.dark.text, fontSize: typography.fontSize.lg, marginBottom: spacing.xl, textAlign: 'center' },
  intentBtn: { backgroundColor: colors.light.primary, padding: spacing.lg, borderRadius: radius.xl },
  intentBtnText: { color: colors.dark.text, fontWeight: typography.fontWeight.bold, fontSize: typography.fontSize.base },
});

export function ErrorBoundary({ error, retry }: import('expo-router').ErrorBoundaryProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Failed to load the resource viewer.</Text>
        <Text style={{ color: colors.light.danger, marginBottom: spacing.xl, textAlign: 'center' }}>
          {error.message}
        </Text>
        <TouchableOpacity onPress={retry} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
