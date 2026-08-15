import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Text, Alert, TextInput, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, typography, radius } from '../../tokens';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { CalendarRepository } from '../../domains/calendar/repository';
import { useWorkspaces } from '../../domains/workspace/hooks';
import { ArrowLeft, Save, Trash2 } from 'lucide-react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import * as Haptics from 'expo-haptics';
import { parseTime } from '../../core/utils/time';
import { parseQuickAdd } from '../../core/utils/quickAdd';

const WEEKDAYS = [
  { label: 'S', value: 0 },
  { label: 'M', value: 1 },
  { label: 'T', value: 2 },
  { label: 'W', value: 3 },
  { label: 'T', value: 4 },
  { label: 'F', value: 5 },
  { label: 'S', value: 6 },
];

const eventSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  location: z.string().optional(),
  startTime: z.string().min(1, 'Start time is required'),
  endTime: z.string().min(1, 'End time is required'),
  type: z.string(),
  isRecurring: z.boolean(),
  selectedDays: z.array(z.number()),
  workspaceId: z.number().nullable(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
}).refine(data => !data.isRecurring || data.selectedDays.length > 0, {
  message: "Please select at least one day for recurring class",
  path: ["selectedDays"],
});

type EventFormData = z.infer<typeof eventSchema>;

export default function AddPlannerEvent() {
  const router = useRouter();
  const { id, workspaceId: paramWorkspaceId } = useLocalSearchParams();
  const eventId = id ? parseInt(id as string, 10) : null;
  const initialWorkspaceId = paramWorkspaceId ? parseInt(paramWorkspaceId as string, 10) : null;
  const isEditing = !!eventId;

  const { workspaces } = useWorkspaces();
  const [userModifiedEndTime, setUserModifiedEndTime] = useState(false);
  const [quickAddInput, setQuickAddInput] = useState('');

  const today = new Date();
  const future = new Date();
  future.setMonth(today.getMonth() + 4);

  const { control, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<EventFormData>({
    resolver: zodResolver(eventSchema),
    mode: 'onBlur',
    defaultValues: {
      title: '',
      description: '',
      location: '',
      startTime: '10:00 AM',
      endTime: '11:00 AM',
      type: 'lecture',
      isRecurring: true,
      selectedDays: [],
      workspaceId: initialWorkspaceId,
      startDate: today.toISOString().split('T')[0],
      endDate: future.toISOString().split('T')[0],
    }
  });

  useEffect(() => {
    if (isEditing && eventId) {
      CalendarRepository.getEventById(eventId).then(evt => {
        if (evt) {
          setValue('title', evt.title || '');
          setValue('description', evt.description || '');
          setValue('location', evt.location || '');
          setValue('startTime', evt.startTime || '10:00 AM');
          setValue('endTime', evt.endTime || '11:00 AM');
          setValue('type', evt.type || 'lecture');
          setValue('workspaceId', evt.workspaceId);
          setValue('isRecurring', evt.dayOfWeek !== null);
          if (evt.dayOfWeek !== null) {
             setValue('selectedDays', [evt.dayOfWeek]);
          }
          if (evt.specificDate) {
             setValue('startDate', evt.specificDate);
          }
        }
      }).catch(console.error);
    }
  }, [isEditing, eventId, setValue]);

  const isRecurring = watch('isRecurring');
  const selectedDays = watch('selectedDays');
  const workspaceId = watch('workspaceId');
  const startTime = watch('startTime');

  // Auto-calculate end time (add 1 hour) if user hasn't manually modified it
  useEffect(() => {
    if (!userModifiedEndTime && startTime) {
      const minutes = parseTime(startTime);
      if (minutes > 0) {
        const endMinutes = minutes + 60;
        const h = Math.floor(endMinutes / 60) % 24;
        const m = endMinutes % 60;
        const ampm = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 || 12;
        const mStr = m.toString().padStart(2, '0');
        setValue('endTime', `${h12}:${mStr} ${ampm}`);
      }
    }
  }, [startTime, userModifiedEndTime, setValue]);

  // Course Metadata Cascade
  useEffect(() => {
    if (workspaceId && workspaces) {
      const ws = workspaces.find((w: any) => w.id === workspaceId);
      if (ws) {
        const currentTitle = watch('title');
        if (!currentTitle) {
          setValue('title', ws.name || ws.code || '', { shouldValidate: true });
        }
      }
    }
  }, [workspaceId, workspaces, setValue, watch]);

  const handleTimeChip = (minutesToAdd: number) => {
    Haptics.selectionAsync();
    const startMins = parseTime(startTime);
    if (startMins > 0) {
      const endMinutes = startMins + minutesToAdd;
      const h = Math.floor(endMinutes / 60) % 24;
      const m = endMinutes % 60;
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 || 12;
      const mStr = m.toString().padStart(2, '0');
      setValue('endTime', `${h12}:${mStr} ${ampm}`, { shouldValidate: true });
      setUserModifiedEndTime(true);
    }
  };

  const toggleDay = (day: number) => {
    Haptics.selectionAsync();
    setValue('selectedDays', 
      selectedDays.includes(day) 
        ? selectedDays.filter(d => d !== day) 
        : [...selectedDays, day].sort(),
      { shouldValidate: true }
    );
  };

  const handleQuickAdd = (text: string) => {
    setQuickAddInput(text);
    const parsed = parseQuickAdd(text);
    if (parsed.title) setValue('title', parsed.title, { shouldValidate: true });
    if (parsed.location) setValue('location', parsed.location, { shouldValidate: true });
    if (parsed.startTime) setValue('startTime', parsed.startTime, { shouldValidate: true });
    if (parsed.startDate) {
      setValue('startDate', parsed.startDate, { shouldValidate: true });
      setValue('isRecurring', false);
    }
    if (parsed.type) setValue('type', parsed.type, { shouldValidate: true });
  };

  const onSubmit = async (data: EventFormData) => {
    try {
      if (isEditing && eventId) {
        // Edit mode
        await CalendarRepository.updateEvent(eventId, {
          title: data.title,
          description: data.description,
          location: data.location,
          startTime: data.startTime,
          endTime: data.endTime,
          type: data.type,
          workspaceId: data.workspaceId,
          ...(data.isRecurring ? { dayOfWeek: data.selectedDays[0] || null, specificDate: null } : { specificDate: data.startDate, dayOfWeek: null })
        });
      } else {
        // Create mode
        const recurrenceGroupId = data.isRecurring ? `${Date.now()}-${Math.random().toString(36).substring(2, 9)}` : null;

        if (data.isRecurring) {
          const eventsToInsert = data.selectedDays.map(day => ({
            title: data.title,
            description: data.description,
            location: data.location,
            startTime: data.startTime,
            endTime: data.endTime,
            type: data.type,
            dayOfWeek: day,
            recurrenceGroupId,
            endDate: data.endDate,
            workspaceId: data.workspaceId
          }));
          await CalendarRepository.createEventsBatch(eventsToInsert);
        } else {
          await CalendarRepository.createEvent({
            title: data.title,
            description: data.description,
            location: data.location,
            startTime: data.startTime,
            endTime: data.endTime,
            type: data.type,
            specificDate: data.startDate,
            workspaceId: data.workspaceId,
          });
        }
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (error) {
      console.error(error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to save event');
    }
  };

  const handleDelete = () => {
    if (!eventId) return;
    Alert.alert('Delete Event', 'Are you sure you want to delete this event?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await CalendarRepository.deleteEvent(eventId);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          router.back();
        } catch (e) {
          Alert.alert('Error', 'Could not delete event');
        }
      }}
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconButton} accessibilityLabel="Go back">
          <ArrowLeft color={colors.light.text} size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEditing ? 'Edit Event' : 'Add Event'}</Text>
        <View style={styles.headerActions}>
          {isEditing && (
            <TouchableOpacity onPress={handleDelete} style={styles.iconButton} accessibilityLabel="Delete">
              <Trash2 color={colors.light.danger} size={24} />
            </TouchableOpacity>
          )}
        </View>
      </View>
      
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.quickAddContainer}>
          <Text style={styles.quickAddLabel}>⚡ Quick Add</Text>
          <TextInput
            style={styles.quickAddInput}
            placeholder="e.g. CSE Lab tomorrow 2pm in Lab 3"
            placeholderTextColor={colors.light.textMuted}
            value={quickAddInput}
            onChangeText={handleQuickAdd}
          />
        </View>

        <Text style={styles.label}>Event Title *</Text>
        <Controller
          control={control}
          name="title"
          render={({ field: { onChange, value } }) => (
            <TextInput 
              style={[styles.input, errors.title && styles.inputError]}
              placeholder="e.g. Data Structures & Algorithms" 
              placeholderTextColor={colors.light.textMuted}
              value={value}
              onChangeText={onChange}
            />
          )}
        />
        {errors.title && <Text style={styles.errorText}>{errors.title.message}</Text>}

        <Text style={styles.label}>Location / Venue</Text>
        <Controller
          control={control}
          name="location"
          render={({ field: { onChange, value } }) => (
            <TextInput 
              style={styles.input}
              placeholder="e.g. Room 301, Science Bldg" 
              placeholderTextColor={colors.light.textMuted}
              value={value}
              onChangeText={onChange}
            />
          )}
        />

        {!initialWorkspaceId && (
          <>
            <Text style={styles.label}>Course / Workspace (Optional)</Text>
            {workspaces && workspaces.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.courseScroll}>
                <TouchableOpacity
                   style={[styles.courseChip, workspaceId === null && styles.courseChipActive]}
                   onPress={() => {
                     Haptics.selectionAsync();
                     setValue('workspaceId', null);
                   }}
                >
                  <Text style={[styles.courseChipText, workspaceId === null && styles.courseChipTextActive]}>None</Text>
                </TouchableOpacity>
                {workspaces.map((ws: any) => (
                  <TouchableOpacity
                    key={ws.id}
                    style={[styles.courseChip, workspaceId === ws.id && styles.courseChipActive]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setValue('workspaceId', ws.id);
                    }}
                  >
                    <Text style={[styles.courseChipText, workspaceId === ws.id && styles.courseChipTextActive]}>
                      {ws.code || ws.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <Text style={styles.helpText}>No courses available. Add one in the Semester tab first!</Text>
            )}
          </>
        )}

        <Text style={styles.label}>Description (Optional)</Text>
        <Controller
          control={control}
          name="description"
          render={({ field: { onChange, value } }) => (
            <TextInput 
              style={[styles.input, styles.textArea]}
              placeholder="e.g. Finish client logo" 
              placeholderTextColor={colors.light.textMuted}
              value={value}
              onChangeText={onChange}
              multiline
            />
          )}
        />

        <View style={styles.timeRow}>
          <View style={styles.timeCol}>
            <Text style={styles.label}>Start Time</Text>
            <Controller
              control={control}
              name="startTime"
              render={({ field: { onChange, value, onBlur } }) => (
                <TextInput 
                  style={[styles.input, errors.startTime && styles.inputError]}
                  placeholder="e.g. 02:00 PM" 
                  placeholderTextColor={colors.light.textMuted}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                />
              )}
            />
            {errors.startTime && <Text style={styles.errorText}>{errors.startTime.message}</Text>}
          </View>
          <View style={{ width: spacing.md }} />
          <View style={styles.timeCol}>
            <Text style={styles.label}>End Time</Text>
            <Controller
              control={control}
              name="endTime"
              render={({ field: { onChange, value, onBlur } }) => (
                <TextInput 
                  style={[styles.input, errors.endTime && styles.inputError]}
                  placeholder="e.g. 04:00 PM" 
                  placeholderTextColor={colors.light.textMuted}
                  value={value}
                  onChangeText={(val) => {
                    setUserModifiedEndTime(true);
                    onChange(val);
                  }}
                  onBlur={onBlur}
                />
              )}
            />
            {errors.endTime && <Text style={styles.errorText}>{errors.endTime.message}</Text>}
          </View>
        </View>

        <View style={styles.chipsContainer}>
          {[
            { label: '+45m', val: 45 },
            { label: '+1h', val: 60 },
            { label: '+1.5h', val: 90 },
            { label: '+2h', val: 120 },
            { label: '+3h', val: 180 }
          ].map(chip => (
            <TouchableOpacity key={chip.label} style={styles.timeChip} onPress={() => handleTimeChip(chip.val)}>
              <Text style={styles.timeChipText}>{chip.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.typeRow}>
          <Text style={styles.label}>Recurring Class?</Text>
          <View style={styles.toggleRow}>
            <TouchableOpacity 
              style={[styles.typeButton, isRecurring && styles.typeButtonActive]}
              onPress={() => {
                Haptics.selectionAsync();
                setValue('isRecurring', true);
              }}
            >
              <Text style={[styles.typeText, isRecurring && styles.typeTextActive]}>Yes</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.typeButton, !isRecurring && styles.typeButtonActive]}
              onPress={() => {
                Haptics.selectionAsync();
                setValue('isRecurring', false);
              }}
            >
              <Text style={[styles.typeText, !isRecurring && styles.typeTextActive]}>No</Text>
            </TouchableOpacity>
          </View>
        </View>

        {isRecurring ? (
          <View style={styles.weekdaysContainer}>
            <Text style={styles.label}>Select Days *</Text>
            <View style={styles.weekdaysRow}>
              {WEEKDAYS.map((day) => {
                const isSelected = selectedDays.includes(day.value);
                return (
                  <TouchableOpacity
                    key={day.value}
                    style={[styles.weekdayCircle, isSelected && styles.weekdayCircleActive]}
                    onPress={() => toggleDay(day.value)}
                  >
                    <Text style={[styles.weekdayText, isSelected && styles.weekdayTextActive]}>
                      {day.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {errors.selectedDays && <Text style={styles.errorText}>{errors.selectedDays.message}</Text>}
            <Text style={styles.label}>End Date (YYYY-MM-DD)</Text>
            <Controller
              control={control}
              name="endDate"
              render={({ field: { onChange, value } }) => (
                <TextInput 
                  style={styles.input}
                  value={value}
                  onChangeText={onChange}
                  placeholder="2026-12-31"
                  placeholderTextColor={colors.light.textMuted}
                />
              )}
            />
          </View>
        ) : (
          <View style={{ marginTop: spacing.md }}>
            <Text style={styles.label}>Specific Date (YYYY-MM-DD)</Text>
            <Controller
              control={control}
              name="startDate"
              render={({ field: { onChange, value } }) => (
                <TextInput 
                  style={styles.input}
                  value={value}
                  onChangeText={onChange}
                  placeholder="2026-08-01"
                  placeholderTextColor={colors.light.textMuted}
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
          <Text style={styles.buttonText}>{isSubmitting ? 'Saving...' : 'Save Event'}</Text>
        </TouchableOpacity>
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
  iconButton: {
    alignItems: 'center',
    padding: spacing.sm,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 40,
    justifyContent: 'flex-end',
  },
  headerTitle: { fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold, color: colors.light.text },
  headerSpacer: { width: 40 },
  container: { flex: 1 },
  content: { padding: spacing.xl },
  quickAddContainer: { marginBottom: spacing.xl, backgroundColor: colors.light.surface, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.light.primary, shadowColor: colors.light.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 },
  quickAddLabel: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold, color: colors.light.primary, marginBottom: spacing.sm },
  quickAddInput: { fontSize: typography.fontSize.base, color: colors.light.text },
  label: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.light.text, marginTop: spacing.lg, marginBottom: spacing.sm },
  input: { backgroundColor: colors.light.surface, borderRadius: radius.lg, padding: spacing.lg, fontSize: typography.fontSize.base, color: colors.light.text, borderWidth: 1, borderColor: colors.light.border },
  inputError: { borderColor: colors.light.danger || 'red' },
  errorText: { color: colors.light.danger || 'red', fontSize: typography.fontSize.sm, marginTop: 4 },
  textArea: { height: 100, textAlignVertical: 'top' },
  timeRow: { flexDirection: 'row' },
  timeCol: { flex: 1 },
  typeRow: { marginTop: spacing.md },
  toggleRow: { flexDirection: 'row', gap: spacing.sm },
  typeButton: { flex: 1, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.light.border, alignItems: 'center' },
  typeButtonActive: { backgroundColor: colors.light.primary, borderColor: colors.light.primary },
  typeText: { color: colors.light.textMuted, fontWeight: typography.fontWeight.semibold },
  typeTextActive: { color: colors.dark.text },
  weekdaysContainer: { marginTop: spacing.md },
  weekdaysRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm, marginBottom: spacing.md },
  weekdayCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.light.surface, borderWidth: 1, borderColor: colors.light.border, alignItems: 'center', justifyContent: 'center' },
  weekdayCircleActive: { backgroundColor: colors.light.primary, borderColor: colors.light.primary },
  weekdayText: { color: colors.light.textMuted, fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.semibold },
  weekdayTextActive: { color: colors.dark.text },
  footer: { padding: spacing.xl, borderTopWidth: 1, borderTopColor: colors.light.border },
  button: { backgroundColor: colors.light.primary, borderRadius: radius.xl, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  buttonDisabled: { opacity: 0.5 },
  saveIcon: { marginRight: spacing.sm },
  buttonText: { color: colors.dark.text, fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.bold },
  courseScroll: { flexDirection: 'row', paddingVertical: spacing.sm, marginHorizontal: -spacing.xl, paddingHorizontal: spacing.xl },
  courseChip: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.full, backgroundColor: colors.light.surface, borderWidth: 1, borderColor: colors.light.border, marginRight: spacing.md },
  courseChipActive: { backgroundColor: colors.light.primary, borderColor: colors.light.primary },
  courseChipText: { color: colors.light.textMuted, fontWeight: typography.fontWeight.semibold },
  courseChipTextActive: { color: colors.dark.text },
  helpText: { fontSize: typography.fontSize.sm, color: colors.light.textMuted, fontStyle: 'italic', marginTop: spacing.sm },
  chipsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  timeChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, backgroundColor: colors.light.surface, borderWidth: 1, borderColor: colors.light.border },
  timeChipText: { color: colors.light.text, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold },
});
