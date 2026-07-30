import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../tokens';

interface AppScaffoldProps {
  children: React.ReactNode;
  useSafeArea?: boolean;
}

export function AppScaffold({ children, useSafeArea = true }: AppScaffoldProps) {
  if (useSafeArea) {
    return (
      <SafeAreaView style={styles.container}>
        {children}
      </SafeAreaView>
    );
  }
  
  return <View style={styles.container}>{children}</View>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.light.background,
  }
});
