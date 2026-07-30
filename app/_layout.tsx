import { Stack } from 'expo-router';
import { PaperProvider, MD3LightTheme } from 'react-native-paper';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { db, expoDb } from '../core/db/client';
import migrations from '../drizzle/migrations';
import { seedFullDatabase } from '../core/db/seed';
import { colors } from '../tokens';
import { View, Text } from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter, useSegments } from 'expo-router';

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

export default function RootLayout() {
  const { success, error } = useMigrations(db, migrations);
  const [isSeeded, setIsSeeded] = useState(false);
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (success) {
      seedFullDatabase()
        .then(async () => {
          setIsSeeded(true);
          try {
            const result = await expoDb.getAllAsync(`SELECT id FROM students LIMIT 1`);
            setHasProfile(result.length > 0);
          } catch (e) {
            console.error("Failed to check profile", e);
            setHasProfile(false);
          }
        })
        .catch((e) => {
          console.error(e);
          setIsSeeded(true);
          setHasProfile(false);
        });
    }
  }, [success]);

  useEffect(() => {
    if (isSeeded && hasProfile !== null) {
      const inMainGroup = segments[0] === '(main)';
      
      if (!hasProfile && inMainGroup) {
        router.replace('/onboarding');
      } else if (hasProfile && !inMainGroup) {
        router.replace('/(main)');
      }
    }
  }, [isSeeded, hasProfile, segments]);

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Error running migrations: {error.message}</Text>
      </View>
    );
  }

  if (!success || !isSeeded || hasProfile === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Loading UniOS...</Text>
      </View>
    );
  }

  return (
    <PaperProvider theme={theme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(main)" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="notifications" options={{ presentation: 'modal' }} />
        <Stack.Screen name="search" options={{ presentation: 'modal' }} />
      </Stack>
    </PaperProvider>
  );
}
