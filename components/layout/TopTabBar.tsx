import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated } from 'react-native';
import { colors, spacing, typography, radius } from '../../tokens';

export type TabItem = {
  key: string;
  label: string;
};

interface TopTabBarProps {
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (key: string) => void;
}

export function TopTabBar({ tabs, activeTab, onTabChange }: TopTabBarProps) {
  const scrollViewRef = useRef<ScrollView>(null);

  // We could implement complex scrollTo active tab logic here, but for v1
  // we'll keep it simple and just rely on manual scroll if needed.
  
  return (
    <View style={styles.container}>
      <ScrollView 
        ref={scrollViewRef}
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {tabs.map((tab) => {
          const isActive = tab.key === activeTab;
          
          return (
            <TouchableOpacity
              key={tab.key}
              activeOpacity={0.7}
              onPress={() => onTabChange(tab.key)}
              style={[
                styles.tabBubble,
                isActive && styles.tabBubbleActive
              ]}
            >
              <Text 
                style={[
                  styles.tabText,
                  isActive && styles.tabTextActive
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
    backgroundColor: colors.light.background,
    paddingVertical: spacing.sm,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  tabBubble: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    backgroundColor: 'transparent',
  },
  tabBubbleActive: {
    backgroundColor: colors.light.surfaceElevated,
  },
  tabText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.light.textMuted,
  },
  tabTextActive: {
    color: colors.light.text,
    fontWeight: typography.fontWeight.semibold,
  },
});
