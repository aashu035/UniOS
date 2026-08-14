import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Save, ChevronDown, ChevronUp } from 'lucide-react-native';
import { colors, radius, spacing, typography } from '../../tokens';

const courseSchema = z.object({
  name: z.string().min(1, 'Course name is required'),
  code: z.string().optional(),
  facultyName: z.string().optional(),
  venueName: z.string().optional(),
  targetAttendance: z.number().min(0).max(100).optional().default(75),
  credits: z.number().min(0).max(20).optional().default(3),
  type: z.enum(['theory', 'lab', 'elective']).optional().default('theory'),
  notes: z.string().optional(),
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
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const { control, handleSubmit, formState: { errors } } = useForm<CourseFormData>({
    resolver: zodResolver(courseSchema) as any,
    mode: 'onBlur',
    defaultValues: {
      name: initialValues?.name || '',
      code: initialValues?.code || '',
      facultyName: initialValues?.facultyName || '',
      venueName: initialValues?.venueName || '',
      targetAttendance: initialValues?.targetAttendance ?? 75,
      credits: initialValues?.credits ?? 3,
      type: initialValues?.type || 'theory',
      notes: initialValues?.notes || '',
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

        <TouchableOpacity style={styles.advancedToggle} onPress={() => setShowAdvanced(!showAdvanced)}>
          <Text style={styles.advancedToggleText}>{showAdvanced ? 'Hide Advanced Settings' : 'Show Advanced Settings'}</Text>
          {showAdvanced ? <ChevronUp size={20} color={colors.light.primary} /> : <ChevronDown size={20} color={colors.light.primary} />}
        </TouchableOpacity>

        {showAdvanced && (
          <View style={styles.advancedSection}>
            <Text style={styles.label}>Credits</Text>
            <Controller
              control={control}
              name="credits"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={styles.input}
                  placeholder="3"
                  placeholderTextColor={colors.light.textMuted}
                  value={value.toString()}
                  onChangeText={(val) => {
                    const parsed = parseInt(val, 10);
                    onChange(isNaN(parsed) ? 0 : parsed);
                  }}
                  onBlur={onBlur}
                  keyboardType="number-pad"
                />
              )}
            />

            <Text style={styles.label}>Type</Text>
            <Controller
              control={control}
              name="type"
              render={({ field: { onChange, value } }) => (
                <View style={styles.typeChips}>
                  {(['theory', 'lab', 'elective'] as const).map(t => (
                    <TouchableOpacity 
                      key={t} 
                      style={[styles.typeChip, value === t && styles.typeChipActive]}
                      onPress={() => onChange(t)}
                    >
                      <Text style={[styles.typeChipText, value === t && styles.typeChipTextActive]}>
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            />

            <Text style={styles.label}>Notes</Text>
            <Controller
              control={control}
              name="notes"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
                  placeholder="Add any additional notes about this course..."
                  placeholderTextColor={colors.light.textMuted}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  multiline
                />
              )}
            />
          </View>
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
  advancedToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.lg, marginTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.light.border },
  advancedToggleText: { color: colors.light.primary, fontWeight: typography.fontWeight.semibold, fontSize: typography.fontSize.sm },
  advancedSection: { paddingBottom: spacing.lg },
  typeChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  typeChip: { borderRadius: radius.full, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.light.border, backgroundColor: colors.light.surface },
  typeChipActive: { backgroundColor: colors.light.primary, borderColor: colors.light.primary },
  typeChipText: { color: colors.light.text, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium },
  typeChipTextActive: { color: colors.dark.text },
  footer: { padding: spacing.xl, borderTopWidth: 1, borderTopColor: colors.light.border },
  button: { backgroundColor: colors.light.primary, borderRadius: radius.xl, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  buttonDisabled: { opacity: 0.5 },
  saveIcon: { marginRight: spacing.sm },
  buttonText: { color: colors.dark.text, fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.bold },
});
