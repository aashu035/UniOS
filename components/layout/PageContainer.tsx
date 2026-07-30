import React from 'react';
import { ScrollView, ScrollViewProps, StyleSheet, View } from 'react-native';
import { spacing } from '../../tokens';

interface PageContainerProps extends ScrollViewProps {
  children: React.ReactNode;
  scrollable?: boolean;
}

export function PageContainer({ children, scrollable = true, style, ...props }: PageContainerProps) {
  if (scrollable) {
    return (
      <ScrollView 
        contentContainerStyle={[styles.container, style]} 
        showsVerticalScrollIndicator={false}
        {...props}
      >
        {children}
      </ScrollView>
    );
  }

  return <View style={[styles.container, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing['4xl'], // Allow space for bottom tabs
  }
});
