import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, SafeAreaView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Plus, Trash2, Clock, MapPin, User, Check, ChevronRight, BookOpen, AlertCircle } from 'lucide-react-native';
import { colors } from '../../tokens';
import { WorkspaceRepository } from '../../domains/workspace/repository';

type ComponentType = 'theory' | 'lab' | 'tutorial';

interface SessionDraft {
  id: string;
  dayOfWeek: number;
  startTime: string;
}

interface ComponentDraft {
  id: string;
  type: ComponentType;
  facultyName: string;
  venueName: string;
  durationMinutes: number;
  sessions: SessionDraft[];
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function CourseBuilder() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);

  // Step 1 State
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [credits, setCredits] = useState('3');
  const [selectedColor, setSelectedColor] = useState(colors.subjects[0].base);

  // Step 2 State
  const [components, setComponents] = useState<ComponentDraft[]>([
    {
      id: 'comp_1',
      type: 'theory',
      facultyName: '',
      venueName: '',
      durationMinutes: 60,
      sessions: []
    }
  ]);

  const addComponent = (type: ComponentType, durationMinutes: number = 60) => {
    setComponents([...components, {
      id: Math.random().toString(),
      type,
      facultyName: '',
      venueName: '',
      durationMinutes,
      sessions: []
    }]);
  };

  const updateComponent = (id: string, updates: Partial<ComponentDraft>) => {
    setComponents(components.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const addSession = (compId: string) => {
    setComponents(components.map(c => {
      if (c.id === compId) {
        return {
          ...c,
          sessions: [...c.sessions, { id: Math.random().toString(), dayOfWeek: 1, startTime: '09:00' }]
        };
      }
      return c;
    }));
  };

  const updateSession = (compId: string, sessionId: string, updates: Partial<SessionDraft>) => {
    setComponents(components.map(c => {
      if (c.id === compId) {
        return {
          ...c,
          sessions: c.sessions.map(s => s.id === sessionId ? { ...s, ...updates } : s)
        };
      }
      return c;
    }));
  };

  const removeSession = (compId: string, sessionId: string) => {
    setComponents(components.map(c => {
      if (c.id === compId) {
        return { ...c, sessions: c.sessions.filter(s => s.id !== sessionId) };
      }
      return c;
    }));
  };

  const removeComponent = (compId: string) => {
    setComponents(components.filter(c => c.id !== compId));
  };

  const calculateEndTime = (startTime: string, durationMinutes: number) => {
    try {
      const [hours, minutes] = startTime.split(':').map(Number);
      if (isNaN(hours) || isNaN(minutes)) return '00:00';
      const date = new Date();
      date.setHours(hours, minutes, 0, 0);
      date.setMinutes(date.getMinutes() + durationMinutes);
      const endH = String(date.getHours()).padStart(2, '0');
      const endM = String(date.getMinutes()).padStart(2, '0');
      return `${endH}:${endM}`;
    } catch {
      return '00:00';
    }
  };

  const validateAndProceedToReview = () => {
    if (!name.trim()) {
      Alert.alert('Missing Info', 'Course name is required.');
      return;
    }
    
    // Check if any component has 0 sessions
    const emptyComps = components.filter(c => c.sessions.length === 0);
    if (emptyComps.length > 0) {
      Alert.alert('Warning', `You have components with no sessions configured. Are you sure you want to proceed?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Proceed', onPress: () => setStep(3) }
      ]);
      return;
    }

    setStep(3); // Go to Review
  };

  const handleConfirmAndCreate = async () => {
    setIsSaving(true);
    try {
      await WorkspaceRepository.buildCompleteWorkspace({
        name,
        code,
        credits: Number(credits) || 3,
        color: selectedColor,
        components: components.map(c => ({
          type: c.type,
          facultyName: c.facultyName,
          venueName: c.venueName,
          durationMinutes: c.durationMinutes,
          sessions: c.sessions.map(s => ({
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime,
            endTime: calculateEndTime(s.startTime, c.durationMinutes),
          }))
        }))
      });
      router.back();
    } catch (error: any) {
      console.error(error);
      Alert.alert('Error', error.message || 'Failed to save course.');
      setIsSaving(false);
    }
  };

  const renderProgress = () => (
    <View>
      <View style={styles.progressRow}>
        <View style={[styles.progressDot, step >= 1 && styles.progressDotActive]} />
        <View style={[styles.progressLine, step >= 2 && styles.progressLineActive]} />
        <View style={[styles.progressDot, step >= 2 && styles.progressDotActive]} />
        <View style={[styles.progressLine, step >= 3 && styles.progressLineActive]} />
        <View style={[styles.progressDot, step >= 3 && styles.progressDotActive]} />
      </View>
      <Text style={styles.progressText}>
        {step === 1 ? '1. Basic Info' : step === 2 ? '2. Academic Structure' : '3. Review'}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => step > 1 ? setStep(step - 1) : router.back()} style={styles.iconButton}>
            <ArrowLeft color={colors.light.text} size={24} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Course Setup</Text>
          <View style={styles.headerSpacer} />
        </View>

        {renderProgress()}

        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          
          {/* STEP 1: Identity */}
          {step === 1 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Course Identity</Text>
              
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Course Name *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Data Structures"
                  value={name}
                  onChangeText={setName}
                  placeholderTextColor={colors.light.textMuted}
                />
              </View>

              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 12 }]}>
                  <Text style={styles.label}>Code</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. CS201"
                    value={code}
                    onChangeText={setCode}
                    placeholderTextColor={colors.light.textMuted}
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Credits</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="3"
                    keyboardType="numeric"
                    value={credits}
                    onChangeText={setCredits}
                    placeholderTextColor={colors.light.textMuted}
                  />
                </View>
              </View>

              <Text style={styles.label}>Subject Color</Text>
              <View style={styles.colorPalette}>
                {colors.subjects.map(c => (
                  <TouchableOpacity
                    key={c.base}
                    style={[styles.colorSwatch, { backgroundColor: c.base }, selectedColor === c.base && styles.colorSwatchActive]}
                    onPress={() => setSelectedColor(c.base)}
                  >
                    {selectedColor === c.base && <Check color="#FFF" size={16} />}
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={styles.primaryButton} onPress={() => setStep(2)}>
                <Text style={styles.primaryButtonText}>Next: Components</Text>
                <ChevronRight color="#FFF" size={20} />
              </TouchableOpacity>
            </View>
          )}

          {/* STEP 2: Components & Sessions */}
          {step === 2 && (
            <View>
              {components.map((comp) => (
                <View key={comp.id} style={styles.componentCard}>
                  <View style={styles.componentHeader}>
                    <View style={styles.componentTitleRow}>
                      <BookOpen size={20} color={colors.light.primary} />
                      <Text style={styles.componentTitle}>
                        {comp.type.charAt(0).toUpperCase() + comp.type.slice(1)} Component
                      </Text>
                    </View>
                    {components.length > 1 && (
                      <TouchableOpacity onPress={() => removeComponent(comp.id)}>
                        <Trash2 size={20} color={colors.light.danger} />
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Component-Level Assignments (Inherited by all sessions) */}
                  <View style={styles.assignmentsBox}>
                    <Text style={styles.assignmentsNotice}>
                      Set faculty and venue once. All {comp.type} sessions will inherit these values.
                    </Text>
                    <View style={styles.assignmentInputs}>
                      <View style={styles.inlineInputWrapper}>
                        <User size={16} color={colors.light.textMuted} />
                        <TextInput
                          style={styles.inlineInput}
                          placeholder="Faculty Name (Optional)"
                          value={comp.facultyName}
                          onChangeText={(t) => updateComponent(comp.id, { facultyName: t })}
                          placeholderTextColor={colors.light.textMuted}
                        />
                      </View>
                      <View style={styles.inlineInputWrapper}>
                        <MapPin size={16} color={colors.light.textMuted} />
                        <TextInput
                          style={styles.inlineInput}
                          placeholder="Venue (Optional)"
                          value={comp.venueName}
                          onChangeText={(t) => updateComponent(comp.id, { venueName: t })}
                          placeholderTextColor={colors.light.textMuted}
                        />
                      </View>
                      <View style={styles.inlineInputWrapper}>
                        <Clock size={16} color={colors.light.textMuted} />
                        <TextInput
                          style={styles.inlineInput}
                          placeholder="Duration (mins)"
                          keyboardType="numeric"
                          value={comp.durationMinutes.toString()}
                          onChangeText={(t) => updateComponent(comp.id, { durationMinutes: parseInt(t) || 0 })}
                          placeholderTextColor={colors.light.textMuted}
                        />
                        <Text style={styles.inlineSuffix}>mins</Text>
                      </View>
                    </View>
                  </View>

                  {/* Sessions Configuration */}
                  <View style={styles.sessionsContainer}>
                    <Text style={styles.sessionsLabel}>Weekly Sessions</Text>
                    
                    {comp.sessions.map((session) => (
                      <View key={session.id} style={styles.sessionRow}>
                        <View style={styles.sessionBox}>
                          <Text style={styles.sessionDayLabel}>Day</Text>
                          <TouchableOpacity 
                            style={styles.daySelector}
                            onPress={() => updateSession(comp.id, session.id, { dayOfWeek: (session.dayOfWeek + 1) % 7 })}
                          >
                            <Text style={styles.daySelectorText}>{DAYS[session.dayOfWeek]}</Text>
                          </TouchableOpacity>
                        </View>

                        <View style={styles.sessionBox}>
                          <Text style={styles.sessionDayLabel}>Start Time (HH:MM)</Text>
                          <TextInput
                            style={styles.timeInput}
                            value={session.startTime}
                            onChangeText={(t) => updateSession(comp.id, session.id, { startTime: t })}
                            placeholder="09:00"
                            placeholderTextColor={colors.light.textMuted}
                          />
                        </View>

                        <View style={styles.sessionBoxDisabled}>
                          <Text style={styles.sessionDayLabel}>Ends</Text>
                          <Text style={styles.timeCalcText}>{calculateEndTime(session.startTime, comp.durationMinutes)}</Text>
                        </View>

                        <TouchableOpacity style={styles.removeSessionBtn} onPress={() => removeSession(comp.id, session.id)}>
                          <Trash2 size={16} color={colors.light.textMuted} />
                        </TouchableOpacity>
                      </View>
                    ))}

                    <TouchableOpacity style={styles.addSessionBtn} onPress={() => addSession(comp.id)}>
                      <Plus size={16} color={colors.light.accent} />
                      <Text style={styles.addSessionText}>Add Session</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

              <View style={styles.addComponentRow}>
                <TouchableOpacity style={styles.addComponentBtn} onPress={() => addComponent('theory', 60)}>
                  <Plus size={16} color={colors.light.text} />
                  <Text style={styles.addComponentText}>Theory</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.addComponentBtn} onPress={() => addComponent('lab', 120)}>
                  <Plus size={16} color={colors.light.text} />
                  <Text style={styles.addComponentText}>Lab</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.addComponentBtn} onPress={() => addComponent('tutorial', 60)}>
                  <Plus size={16} color={colors.light.text} />
                  <Text style={styles.addComponentText}>Tutorial</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity 
                style={[styles.primaryButton, { marginTop: 24, marginBottom: 48 }]} 
                onPress={validateAndProceedToReview}
              >
                <Text style={styles.primaryButtonText}>Review Course</Text>
                <ChevronRight color="#FFF" size={20} />
              </TouchableOpacity>
            </View>
          )}

          {/* STEP 3: Review Screen */}
          {step === 3 && (
            <View style={styles.reviewContainer}>
              <View style={[styles.reviewHeader, { backgroundColor: selectedColor }]}>
                <Text style={styles.reviewTitle}>{name}</Text>
                <Text style={styles.reviewSubtitle}>{code ? `${code} • ` : ''}{credits} Credits</Text>
              </View>

              <View style={styles.reviewNoticeBox}>
                <AlertCircle size={16} color={colors.light.warning} />
                <Text style={styles.reviewNoticeText}>
                  Please review the academic structure below. No data has been saved yet.
                </Text>
              </View>

              {components.map((comp) => (
                <View key={comp.id} style={styles.reviewComponent}>
                  <Text style={styles.reviewCompTitle}>{comp.type.toUpperCase()}</Text>
                  
                  <View style={styles.reviewCompMeta}>
                    {comp.facultyName ? <Text style={styles.reviewMetaText}><User size={12} color={colors.light.textMuted}/> {comp.facultyName}</Text> : null}
                    {comp.venueName ? <Text style={styles.reviewMetaText}><MapPin size={12} color={colors.light.textMuted}/> {comp.venueName}</Text> : null}
                  </View>

                  {comp.sessions.length > 0 ? (
                    comp.sessions.map((session, idx) => (
                      <View key={idx} style={styles.reviewSessionRow}>
                        <Text style={styles.reviewSessionDay}>{DAYS[session.dayOfWeek]}</Text>
                        <Text style={styles.reviewSessionTime}>
                          {session.startTime} - {calculateEndTime(session.startTime, comp.durationMinutes)}
                        </Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.reviewEmptyText}>No sessions configured.</Text>
                  )}
                </View>
              ))}

              <TouchableOpacity 
                style={[styles.primaryButton, { marginTop: 24, marginBottom: 48, backgroundColor: colors.light.success }]} 
                onPress={handleConfirmAndCreate}
                disabled={isSaving}
              >
                {isSaving ? <ActivityIndicator color="#FFF" size="small" /> : (
                  <>
                    <Text style={styles.primaryButtonText}>Confirm & Create Course</Text>
                    <Check color="#FFF" size={20} />
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
          
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.light.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, backgroundColor: colors.light.surfaceElevated,
  },
  iconButton: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.light.text, fontFamily: 'Inter' },
  headerSpacer: { width: 40 },
  
  progressRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 32, marginTop: 16, justifyContent: 'center' },
  progressDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.light.border },
  progressDotActive: { backgroundColor: colors.light.accent },
  progressLine: { width: 40, height: 2, backgroundColor: colors.light.border, marginHorizontal: 8 },
  progressLineActive: { backgroundColor: colors.light.accent },
  progressText: { textAlign: 'center', marginTop: 12, fontSize: 12, fontWeight: '600', color: colors.light.textMuted, fontFamily: 'Inter' },

  content: { padding: 16, marginTop: 8 },
  
  card: { backgroundColor: colors.light.surfaceElevated, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: colors.light.border, marginBottom: 24 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.light.text, fontFamily: 'Inter', marginBottom: 24 },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 12, fontWeight: '600', color: colors.light.textMuted, marginBottom: 8, letterSpacing: 0.5 },
  input: {
    backgroundColor: colors.light.background,
    borderWidth: 1, borderColor: colors.light.border,
    borderRadius: 8, padding: 14, fontSize: 16,
    color: colors.light.text, fontFamily: 'Inter',
  },
  row: { flexDirection: 'row' },
  
  colorPalette: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8, marginBottom: 24 },
  colorSwatch: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  colorSwatchActive: { transform: [{ scale: 1.1 }] },

  primaryButton: {
    backgroundColor: colors.light.accent, borderRadius: 12, padding: 16,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
  },
  primaryButtonText: { color: '#FFF', fontSize: 16, fontWeight: '600', marginRight: 8, fontFamily: 'Inter' },

  componentCard: {
    backgroundColor: colors.light.surfaceElevated, borderRadius: 16, borderWidth: 1, borderColor: colors.light.border,
    marginBottom: 24, overflow: 'hidden'
  },
  componentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: colors.light.surface, borderBottomWidth: 1, borderBottomColor: colors.light.border },
  componentTitleRow: { flexDirection: 'row', alignItems: 'center' },
  componentTitle: { fontSize: 16, fontWeight: '700', color: colors.light.text, fontFamily: 'Inter', marginLeft: 8 },
  
  assignmentsBox: { padding: 16, backgroundColor: colors.light.background },
  assignmentsNotice: { fontSize: 12, color: colors.light.textMuted, marginBottom: 12, fontStyle: 'italic', fontFamily: 'Inter' },
  assignmentInputs: { gap: 12 },
  inlineInputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.light.surface, borderRadius: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.light.border },
  inlineInput: { flex: 1, paddingVertical: 12, marginLeft: 8, fontSize: 14, color: colors.light.text, fontFamily: 'Inter' },
  inlineSuffix: { fontSize: 12, color: colors.light.textMuted, fontFamily: 'Inter' },

  sessionsContainer: { padding: 16, borderTopWidth: 1, borderTopColor: colors.light.border },
  sessionsLabel: { fontSize: 14, fontWeight: '600', color: colors.light.text, marginBottom: 16, fontFamily: 'Inter' },
  sessionRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 16, gap: 12 },
  sessionBox: { flex: 1 },
  sessionBoxDisabled: { flex: 1, opacity: 0.7 },
  sessionDayLabel: { fontSize: 10, fontWeight: '600', color: colors.light.textMuted, marginBottom: 4, textTransform: 'uppercase' },
  daySelector: { backgroundColor: colors.light.surface, paddingVertical: 12, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: colors.light.border },
  daySelectorText: { fontSize: 14, fontWeight: '600', color: colors.light.primary, fontFamily: 'Inter' },
  timeInput: { backgroundColor: colors.light.surface, paddingVertical: 12, borderRadius: 8, textAlign: 'center', borderWidth: 1, borderColor: colors.light.border, fontSize: 14, fontFamily: 'Inter' },
  timeCalcText: { backgroundColor: colors.light.background, paddingVertical: 12, textAlign: 'center', color: colors.light.textMuted, fontSize: 14, fontFamily: 'Inter' },
  removeSessionBtn: { padding: 12, marginBottom: 2 },

  addSessionBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  addSessionText: { fontSize: 14, fontWeight: '600', color: colors.light.accent, marginLeft: 8, fontFamily: 'Inter' },

  addComponentRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginTop: -8 },
  addComponentBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.light.surfaceElevated, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 24, borderWidth: 1, borderColor: colors.light.border },
  addComponentText: { fontSize: 14, fontWeight: '500', color: colors.light.text, marginLeft: 8, fontFamily: 'Inter' },

  reviewContainer: { paddingBottom: 40 },
  reviewHeader: { padding: 24, borderRadius: 16, marginBottom: 16 },
  reviewTitle: { fontSize: 24, fontWeight: '700', color: '#FFF', fontFamily: 'Inter' },
  reviewSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.8)', fontFamily: 'Inter', marginTop: 4 },
  
  reviewNoticeBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.light.warning + '15', padding: 12, borderRadius: 8, marginBottom: 24 },
  reviewNoticeText: { fontSize: 13, color: colors.light.warning, fontFamily: 'Inter', marginLeft: 8, flex: 1 },

  reviewComponent: { backgroundColor: colors.light.surfaceElevated, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: colors.light.border, marginBottom: 16 },
  reviewCompTitle: { fontSize: 14, fontWeight: '700', color: colors.light.text, fontFamily: 'Inter', marginBottom: 8, letterSpacing: 0.5 },
  reviewCompMeta: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  reviewMetaText: { fontSize: 13, color: colors.light.textMuted, fontFamily: 'Inter' },
  
  reviewSessionRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.light.surface },
  reviewSessionDay: { fontSize: 14, fontWeight: '600', color: colors.light.text, fontFamily: 'Inter' },
  reviewSessionTime: { fontSize: 14, color: colors.light.textMuted, fontFamily: 'Inter' },
  reviewEmptyText: { fontSize: 13, color: colors.light.textMuted, fontStyle: 'italic', marginTop: 8 },
});
