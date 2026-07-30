import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '../../tokens';

export default function Semester() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Semester</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.light.background },
  container: { flex: 1, padding: spacing.lg, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: typography.fontSize.xl, color: colors.light.textMuted }
});
