import React from 'react';
import { Stack, router } from 'expo-router';
import { PaperProvider, MD3LightTheme, Button } from 'react-native-paper';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { db, expoDb } from '../core/db/client';
import migrations from '../drizzle/migrations';
import { colors } from '../tokens';
import { View, Text, Alert } from 'react-native';
import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { ProfileContext } from '../core/context/ProfileContext';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sentry from '@sentry/react-native';
import { isRunningInExpoGo } from 'expo';

Sentry.init({
  dsn: 'https://f7dbe1260e7f28e50afb2a04b1b83bf1@o4509450523049984.ingest.us.sentry.io/4509450526851072',
  sendDefaultPii: true,
  // Capture 100% of traces in dev/preview, reduce in production
  tracesSampleRate: __DEV__ ? 1.0 : 0.2,
  // Capture profiles for 100% of sampled traces
  profilesSampleRate: 1.0,
  // Replay 100% of errors, 10% of sessions
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  integrations: [
    Sentry.mobileReplayIntegration(),
    // @ts-ignore
    Sentry.expoRouterIntegration ? Sentry.expoRouterIntegration({
      enableTimeToInitialDisplay: !isRunningInExpoGo(),
    }) : undefined,
  ].filter(Boolean) as any,
  enableNativeFramesTracking: !isRunningInExpoGo(),
  enableLogs: true,
});

const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: colors.light.primary,
    background: colors.light.background,
    surface: colors.light.surface,
    error: colors.light.danger,
  },
};

/**
 * Reload the app by navigating to root. In production builds with expo-updates,
 * you'd use Updates.reloadAsync(). For dev/preview builds without expo-updates,
 * we force a root navigation which re-runs the layout and re-triggers migrations.
 */
const reloadApp = () => {
  try {
    // Force the root layout to re-mount by navigating away
    router.replace('/');
  } catch {
    // If router isn't ready, alert the user to manually restart
    Alert.alert('Restart Required', 'Please close and reopen the app.');
  }
};

// ─── Top-Level Error Boundary (Runtime Rendering Crashes) ─────────────────────
class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('AppErrorBoundary caught:', error, errorInfo);
    Sentry.captureException(error, { extra: { componentStack: errorInfo.componentStack } });
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: colors.light.background }}>
          <Text style={{ fontSize: 22, fontWeight: 'bold', color: colors.light.danger, marginBottom: 8 }}>Something went wrong</Text>
          <Text style={{ textAlign: 'center', color: colors.light.textMuted, marginBottom: 16, paddingHorizontal: 16 }}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </Text>
          <Button mode="contained" onPress={() => this.setState({ hasError: false, error: null })} style={{ marginBottom: 8 }}>
            Try Again
          </Button>
          <Button mode="outlined" onPress={reloadApp}>
            Reload App
          </Button>
        </View>
      );
    }
    return this.props.children;
  }
}

// ─── Migration Error Screen (Database Startup Failures) ──────────────────────
function MigrationErrorScreen({ error }: { error: Error }) {
  const handleResetDatabase = () => {
    Alert.alert(
      'Reset Database',
      'This will delete ALL your data (courses, attendance, tasks, resources) and restart the app. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset & Restart',
          style: 'destructive',
          onPress: async () => {
            try {
              const dbPath = `${FileSystem.documentDirectory}SQLite/unios.db`;
              await FileSystem.deleteAsync(dbPath, { idempotent: true });
              reloadApp();
            } catch (e) {
              console.error('Failed to reset database:', e);
              Alert.alert('Reset Failed', 'Could not delete the database file. Please reinstall the app.');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: colors.light.background }}>
      <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.light.danger, marginBottom: 12 }}>Database Migration Failed</Text>
      <Text style={{ textAlign: 'center', marginBottom: 8, color: colors.light.text }}>{error.message}</Text>
      <Text style={{ textAlign: 'center', marginBottom: 24, color: colors.light.textMuted, fontSize: 13 }}>
        This usually happens after an app update. Try retrying first. If the problem persists, resetting the database will fix it but erase all local data.
      </Text>
      <Button mode="contained" onPress={reloadApp} style={{ marginBottom: 12, width: '80%' }}>
        Retry / Reload App
      </Button>
      <Button mode="outlined" onPress={handleResetDatabase} style={{ width: '80%' }} textColor={colors.light.danger}>
        Reset Database (lose all data)
      </Button>
    </View>
  );
}

// ─── Root Layout ─────────────────────────────────────────────────────────────
function RootLayout() {
  const { success, error } = useMigrations(db, migrations);
  const [isSeeded, setIsSeeded] = useState(false);
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const navRouter = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (success) {
      setIsSeeded(true);
      expoDb.getAllAsync(`SELECT id FROM students LIMIT 1`)
        .then((result) => {
          setHasProfile(result.length > 0);
        })
        .catch((e) => {
          console.error("Failed to check profile", e);
          setHasProfile(false);
        });
    }
  }, [success]);

  useEffect(() => {
    if (isSeeded && hasProfile !== null) {
      const onOnboarding = segments[0] === 'onboarding';

      if (!hasProfile && !onOnboarding) {
        expoDb.getAllAsync(`SELECT id FROM students LIMIT 1`).then((result) => {
          if (result.length > 0) {
            setHasProfile(true);
          } else {
            navRouter.replace('/onboarding');
          }
        }).catch(() => {
          navRouter.replace('/onboarding');
        });
      } else if (hasProfile && onOnboarding) {
        navRouter.replace('/(main)/home');
      }
    }
  }, [isSeeded, hasProfile, segments]);

  if (error) {
    return <MigrationErrorScreen error={error} />;
  }

  if (!success || !isSeeded || hasProfile === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Loading UniOS...</Text>
      </View>
    );
  }

  return (
    <AppErrorBoundary>
      <ProfileContext.Provider value={{ hasProfile, setHasProfile }}>
        <PaperProvider theme={theme}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(main)" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="notifications" options={{ presentation: 'modal' }} />
            <Stack.Screen name="search" options={{ presentation: 'modal' }} />
            <Stack.Screen name="course/add" options={{ presentation: 'formSheet' }} />
            <Stack.Screen name="course/edit" options={{ presentation: 'formSheet' }} />
            <Stack.Screen name="planner/add" options={{ presentation: 'formSheet' }} />
          </Stack>
        </PaperProvider>
      </ProfileContext.Provider>
    </AppErrorBoundary>
  );
}

export default Sentry.wrap(RootLayout);
