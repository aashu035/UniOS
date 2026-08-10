import React from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Save } from 'lucide-react-native';
import { colors, radius, spacing, typography } from '../../tokens';

const courseSchema = z.object({
  name: z.string().min(1, 'Course name is required'),
  code: z.string().optional(),
  facultyName: z.string().optional(),
  venueName: z.string().optional(),
  targetAttendance: z.number().min(0).max(100).optional().default(75),
});

export type CourseFormData = z.infer<typeof courseSchema>;

interface CourseFormProps {
  initialValues?: Partial<CourseFormData>;
  onSubmit: (data: CourseFormData) => Promise<void>;
  isSubmitting: boolean;
  submitLabel: string;
  showFacultyVenue?: boolean;
  showTargetAttendance?: boolean;
}

export function CourseForm({ 
  initialValues, 
  onSubmit, 
  isSubmitting, 
  submitLabel,
  showFacultyVenue = true,
  showTargetAttendance = false
}: CourseFormProps) {
  const { control, handleSubmit, formState: { errors } } = useForm<CourseFormData>({
    resolver: zodResolver(courseSchema),
    mode: 'onBlur',
    defaultValues: {
      name: initialValues?.name || '',
      code: initialValues?.code || '',
      facultyName: initialValues?.facultyName || '',
      venueName: initialValues?.venueName || '',
      targetAttendance: initialValues?.targetAttendance ?? 75,
    }
  });

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Course name *</Text>
        <Controller
          control={control}
          name="name"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={[styles.input, errors.name && styles.inputError]}
              placeholder="e.g. Database Management Systems"
              placeholderTextColor={colors.light.textMuted}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              autoFocus
            />
          )}
        />
        {errors.name && <Text style={styles.errorText}>{errors.name.message}</Text>}

        <Text style={styles.label}>Course code</Text>
        <Controller
          control={control}
          name="code"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={styles.input}
              placeholder="e.g. CSE-301"
              placeholderTextColor={colors.light.textMuted}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              autoCapitalize="characters"
            />
          )}
        />

        {showTargetAttendance && (
          <>
            <Text style={styles.label}>Attendance target (%)</Text>
            <Controller
              control={control}
              name="targetAttendance"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={[styles.input, errors.targetAttendance && styles.inputError]}
                  placeholder="75"
                  placeholderTextColor={colors.light.textMuted}
                  value={value.toString()}
                  onChangeText={(val) => {
                    const parsed = parseInt(val, 10);
                    onChange(isNaN(parsed) ? 0 : parsed);
                  }}
                  onBlur={onBlur}
                  keyboardType="decimal-pad"
                />
              )}
            />
            {errors.targetAttendance && <Text style={styles.errorText}>{errors.targetAttendance.message}</Text>}
          </>
        )}

        {showFacultyVenue && (
          <>
            <Text style={styles.label}>Faculty name</Text>
            <Controller
              control={control}
              name="facultyName"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Dr. Rakesh Kumar"
                  placeholderTextColor={colors.light.textMuted}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                />
              )}
            />

            <Text style={styles.label}>Venue / room</Text>
            <Controller
              control={control}
              name="venueName"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={styles.input}
                  placeholder="e.g. New Block A-204"
                  placeholderTextColor={colors.light.textMuted}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                />
              )}
            />
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.button, isSubmitting && styles.buttonDisabled]}
          onPress={handleSubmit(onSubmit)}
          disabled={isSubmitting}
        >
          <Save color={colors.dark.text} size={20} style={styles.saveIcon} />
          <Text style={styles.buttonText}>{isSubmitting ? 'Saving…' : submitLabel}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.xl },
  label: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.light.text, marginTop: spacing.lg, marginBottom: spacing.sm },
  input: { backgroundColor: colors.light.surface, borderRadius: radius.lg, padding: spacing.lg, fontSize: typography.fontSize.base, color: colors.light.text, borderWidth: 1, borderColor: colors.light.border },
  inputError: { borderColor: colors.light.danger || 'red' },
  errorText: { color: colors.light.danger || 'red', fontSize: typography.fontSize.sm, marginTop: 4 },
  footer: { padding: spacing.xl, borderTopWidth: 1, borderTopColor: colors.light.border },
  button: { backgroundColor: colors.light.primary, borderRadius: radius.xl, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  buttonDisabled: { opacity: 0.5 },
  saveIcon: { marginRight: spacing.sm },
  buttonText: { color: colors.dark.text, fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.bold },
});
