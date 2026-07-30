import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { colors, spacing, typography, radius } from '../tokens';
import { ProfileRepository } from '../domains/profile/repository';
import { ArrowRight } from 'lucide-react-native';

export default function Onboarding() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [branch, setBranch] = useState('');
  const [semester, setSemester] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleNext = async () => {
    if (!name.trim() || !branch.trim() || !semester.trim()) return;
    
    setIsSubmitting(true);
    try {
      await ProfileRepository.createProfile({
        name: name.trim(),
        branch: branch.trim(),
        currentSemester: parseInt(semester, 10) || 1,
      });
      router.replace('/(main)');
    } catch (error) {
      console.error('Error saving profile:', error);
      setIsSubmitting(false);
    }
  };

  const isFormValid = name.trim() && branch.trim() && semester.trim();

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.content}>
          <Text style={styles.title}>Welcome</Text>
          <Text style={styles.subtitle}>Let's set up your UniOS profile.</Text>

          <View style={styles.formContainer}>
            <Text style={styles.label}>Name</Text>
            <TextInput 
              style={styles.input} 
              placeholder="e.g. Harsh"
              placeholderTextColor={colors.light.textMuted}
              value={name}
              onChangeText={setName}
              autoFocus
            />
            
            <Text style={[styles.label, { marginTop: spacing.xl }]}>Branch</Text>
            <TextInput 
              style={styles.input} 
              placeholder="e.g. Computer Science"
              placeholderTextColor={colors.light.textMuted}
              value={branch}
              onChangeText={setBranch}
            />
            
            <Text style={[styles.label, { marginTop: spacing.xl }]}>Semester</Text>
            <TextInput 
              style={styles.input} 
              placeholder="e.g. 4"
              placeholderTextColor={colors.light.textMuted}
              value={semester}
              onChangeText={setSemester}
              keyboardType="numeric"
            />
          </View>

          <TouchableOpacity 
            style={[styles.button, (!isFormValid || isSubmitting) && styles.buttonDisabled]} 
            onPress={handleNext}
            disabled={!isFormValid || isSubmitting}
          >
            <Text style={styles.buttonText}>{isSubmitting ? 'Saving...' : 'Done'}</Text>
            {!isSubmitting && <ArrowRight color="#fff" size={20} style={{ marginLeft: spacing.sm }} />}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.light.background,
  },
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: spacing.xxl,
    justifyContent: 'center',
  },
  title: {
    fontSize: typography.fontSize['4xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.light.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.fontSize.base,
    color: colors.light.textMuted,
    marginBottom: spacing['3xl'],
  },
  formContainer: {
    marginBottom: spacing['3xl'],
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.light.text,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.light.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    fontSize: typography.fontSize.base,
    color: colors.light.text,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  button: {
    backgroundColor: colors.light.primary,
    borderRadius: radius.xl,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: colors.dark.text,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  }
});
