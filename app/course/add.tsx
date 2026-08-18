import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, SafeAreaView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useNavigation } from 'expo-router';
import { ArrowLeft, Plus, Trash2, Clock, MapPin, User, Check, ChevronRight, BookOpen, AlertCircle, Cpu, GitMerge, Shield, Network, Code, Brain, HardHat, Sigma, Atom, FlaskConical, Database, Book, X } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors } from '../../tokens';
import { WorkspaceRepository } from '../../domains/workspace/repository';

const ICON_MAP: Record<string, any> = {
  'cpu': Cpu,
  'git-merge': GitMerge,
  'shield': Shield,
  'network': Network,
  'code': Code,
  'brain': Brain,
  'hard-hat': HardHat,
  'sigma': Sigma,
  'atom': Atom,
  'flask-conical': FlaskConical,
  'database': Database,
  'book': Book,
};

const suggestIcon = (courseName: string) => {
  const lower = courseName.toLowerCase();
  if (lower.includes('embed') || lower.includes('micro') || lower.includes('cpu')) return 'cpu';
  if (lower.includes('automata') || lower.includes('formal') || lower.includes('graph')) return 'git-merge';
  if (lower.includes('security') || lower.includes('cyber') || lower.includes('crypt')) return 'shield';
  if (lower.includes('network') || lower.includes('internet')) return 'network';
  if (lower.includes('python') || lower.includes('program') || lower.includes('code') || lower.includes('software')) return 'code';
  if (lower.includes('soft') || lower.includes('neural') || lower.includes('ai') || lower.includes('machine')) return 'brain';
  if (lower.includes('safet') || lower.includes('industr')) return 'hard-hat';
  if (lower.includes('math') || lower.includes('calc') || lower.includes('algebra')) return 'sigma';
  if (lower.includes('physic') || lower.includes('mechan')) return 'atom';
  if (lower.includes('chemistr') || lower.includes('bio')) return 'flask-conical';
  if (lower.includes('dbms') || lower.includes('data')) return 'database';
  return 'book';
};

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
const DRAFT_KEY = '@unios_course_draft';

export default function CourseBuilder() {
  const router = useRouter();
  const navigation = useNavigation();
  const [step, setStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [isDraftRestored, setIsDraftRestored] = useState(false);
  
  const [activeTimePicker, setActiveTimePicker] = useState<{compId: string, sessionId: string} | null>(null);

  const handleTimeChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setActiveTimePicker(null);
    }
    if (selectedDate && activeTimePicker) {
      const hours = selectedDate.getHours().toString().padStart(2, '0');
      const minutes = selectedDate.getMinutes().toString().padStart(2, '0');
      updateSession(activeTimePicker.compId, activeTimePicker.sessionId, { startTime: `${hours}:${minutes}` });
    }
  };

  // Step 1 State
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [credits, setCredits] = useState('3');
  const [selectedColor, setSelectedColor] = useState(colors.subjects[0].base);
  const [icon, setIcon] = useState('book');
  const [iconTouched, setIconTouched] = useState(false);

  // Step 2 State
  type CourseTemplate = 'theory_only' | 'theory_lab' | 'theory_tutorial';
  const [template, setTemplate] = useState<CourseTemplate>('theory_only');

  const [components, setComponents] = useState<ComponentDraft[]>([
    {
      id: 'comp_theory',
      type: 'theory',
      facultyName: '',
      venueName: '',
      durationMinutes: 60,
      sessions: []
    }
  ]);

  useEffect(() => {
    // Restore draft on mount
    const loadDraft = async () => {
      try {
        const saved = await AsyncStorage.getItem(DRAFT_KEY);
        if (saved) {
          const draft = JSON.parse(saved);
          setName(draft.name || '');
          setCode(draft.code || '');
          setCredits(draft.credits || '3');
          setSelectedColor(draft.selectedColor || colors.subjects[0].base);
          if (draft.icon) {
            setIcon(draft.icon);
            setIconTouched(draft.iconTouched || false);
          }
          if (draft.components) setComponents(draft.components);
          if (draft.template) setTemplate(draft.template);
          if (draft.step) setStep(draft.step);
        }
      } catch (e) {
        console.warn('Failed to load draft:', e);
      } finally {
        setIsDraftRestored(true);
      }
    };
    loadDraft();
  }, []);

  const saveDraft = async () => {
    try {
      await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify({
        step, name, code, credits, selectedColor, icon, iconTouched, template, components
      }));
    } catch (e) {
      console.warn('Failed to save draft:', e);
    }
  };

  const clearDraft = async () => {
    try {
      await AsyncStorage.removeItem(DRAFT_KEY);
    } catch (e) {
      console.warn('Failed to clear draft:', e);
    }
  };

  useEffect(() => {
    if (!isDraftRestored) return;

    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      // If we are saving normally (isSaving = true), don't show alert
      if (isSaving) return;

      // If form is completely empty (no changes), just go back
      if (!name.trim() && !code.trim() && components.every(c => c.sessions.length === 0) && !iconTouched && step === 1) {
        return;
      }

      e.preventDefault();

      Alert.alert(
        'Discard changes?',
        'You have unsaved changes. Do you want to save them as a draft or discard?',
        [
          { text: 'Keep Editing', style: 'cancel', onPress: () => {} },
          { 
            text: 'Save Draft', 
            onPress: async () => {
              await saveDraft();
              navigation.dispatch(e.data.action);
            }
          },
          { 
            text: 'Discard', 
            style: 'destructive', 
            onPress: async () => {
              await clearDraft();
              navigation.dispatch(e.data.action);
            }
          }
        ]
      );
    });

    return unsubscribe;
  }, [navigation, isDraftRestored, isSaving, name, code, components, iconTouched, step, credits, selectedColor, icon, template]);

  const handleNameChange = (text: string) => {
    setName(text);
    // Auto-suggest if the user hasn't actively locked an icon, but for simplicity, we suggest on every keystroke if it finds a strong match, or we could just set it.
    // Better UX: Only auto-suggest if they haven't explicitly picked one, but we don't have an explicitlyPicked state.
    // We'll just suggest and let them override. It might overwrite their override if they keep typing name though.
    // Let's add a touched flag.
    if (!iconTouched) {
      setIcon(suggestIcon(text));
    }
  };


  const handleTemplateSelection = (t: CourseTemplate) => {
    setTemplate(t);
    const theory = components.find(c => c.type === 'theory') || {
      id: 'comp_theory', type: 'theory', facultyName: '', venueName: '', durationMinutes: 60, sessions: []
    };
    if (t === 'theory_only') {
      setComponents([theory]);
    } else if (t === 'theory_lab') {
      const lab = components.find(c => c.type === 'lab') || {
        id: 'comp_lab', type: 'lab', facultyName: '', venueName: '', durationMinutes: 120, sessions: []
      };
      setComponents([theory, lab]);
    } else if (t === 'theory_tutorial') {
      const tutorial = components.find(c => c.type === 'tutorial') || {
        id: 'comp_tutorial', type: 'tutorial', facultyName: '', venueName: '', durationMinutes: 60, sessions: []
      };
      setComponents([theory, tutorial]);
    }
  };

  const updateComponent = (id: string, updates: Partial<ComponentDraft>) => {
    setComponents(components.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const hasOverlap = (sessions: SessionDraft[], newStart: string, newEnd: string, dayOfWeek: number, ignoreId?: string) => {
    return sessions.some(s => {
      if (ignoreId && s.id === ignoreId) return false;
      if (s.dayOfWeek !== dayOfWeek) return false;
      const existingEnd = calculateEndTime(s.startTime, 120); // fallback, but we should use real duration
      // We need to compare time correctly, let's just do simple string compare since format is HH:MM
      return (newStart < existingEnd && newEnd > s.startTime);
    });
  };

  const addSession = (compId: string) => {
    setComponents(components.map(c => {
      if (c.id === compId) {
        let newStart = '09:00';
        // Auto-increment default start time based on existing sessions
        if (c.sessions.length > 0) {
          const lastSession = c.sessions[c.sessions.length - 1];
          newStart = calculateEndTime(lastSession.startTime, c.durationMinutes);
        }
        
        return {
          ...c,
          sessions: [...c.sessions, { id: Math.random().toString(), dayOfWeek: 1, startTime: newStart }]
        };
      }
      return c;
    }));
  };

  const updateSession = (compId: string, sessionId: string, updates: Partial<SessionDraft>) => {
    setComponents(components.map(c => {
      if (c.id === compId) {
        const currentSession = c.sessions.find(s => s.id === sessionId);
        if (!currentSession) return c;
        const testStart = updates.startTime !== undefined ? updates.startTime : currentSession.startTime;
        const testDay = updates.dayOfWeek !== undefined ? updates.dayOfWeek : currentSession.dayOfWeek;
        const testEnd = calculateEndTime(testStart, c.durationMinutes);
        
        if (testStart >= testEnd) {
          // Alert.alert('Invalid Time', 'Start time must be before end time.');
          // With a proper picker, this should be impossible, but we'll ignore invalid changes
          return c;
        }

        // We converted hard overlaps to soft overlaps. The UI should show a warning, but we still allow the state update.
        // We will do overlap checks at the Step level to show warnings instead of blocking.

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

  const validateAndProceedToStep2 = () => {
    if (!name.trim()) {
      Alert.alert('Missing Info', 'Course name is required.');
      return;
    }
    setStep(2);
  };

  const validateAndProceedToReview = () => {
    // Check if any component has 0 sessions
    const emptyComps = components.filter(c => c.sessions.length === 0);
    if (emptyComps.length > 0) {
      Alert.alert('Warning', `You have components with no sessions configured. Are you sure you want to proceed?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Proceed', onPress: () => checkOverlapsAndProceed() }
      ]);
      return;
    }
    checkOverlapsAndProceed();
  };

  const checkOverlapsAndProceed = () => {
    const allSessions = components.flatMap(c => c.sessions.map(s => ({ ...s, duration: c.durationMinutes })));
    let hasOverlapGlobally = false;
    for (let i = 0; i < allSessions.length; i++) {
      for (let j = i + 1; j < allSessions.length; j++) {
        if (allSessions[i].dayOfWeek === allSessions[j].dayOfWeek) {
          const start1 = allSessions[i].startTime;
          const end1 = calculateEndTime(start1, allSessions[i].duration);
          const start2 = allSessions[j].startTime;
          const end2 = calculateEndTime(start2, allSessions[j].duration);
          if (start1 < end2 && start2 < end1) {
             hasOverlapGlobally = true;
          }
        }
      }
    }

    if (hasOverlapGlobally) {
      Alert.alert('Schedule Overlap', 'Some of your sessions overlap. Are you sure you want to proceed?', [
        { text: 'Fix It', style: 'cancel' },
        { text: 'Proceed Anyway', onPress: () => setStep(3) }
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
        icon,
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
      if (error.message === 'NO_ACTIVE_SEMESTER') {
        Alert.alert('No Active Semester', 'Please set an active semester in settings before creating a course.');
      } else {
        Alert.alert('Error', error.message || 'Failed to save course.');
      }
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
                  onChangeText={handleNameChange}
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

              <Text style={styles.label}>Subject Color & Icon</Text>
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

              <View style={styles.iconPalette}>
                {Object.keys(ICON_MAP).map(iconKey => {
                  const IconComp = ICON_MAP[iconKey];
                  const isSelected = icon === iconKey;
                  return (
                    <TouchableOpacity
                      key={iconKey}
                      style={[styles.iconSwatch, isSelected && { borderColor: selectedColor, backgroundColor: selectedColor + '15' }]}
                      onPress={() => {
                        setIcon(iconKey);
                        setIconTouched(true);
                      }}
                    >
                      <IconComp color={isSelected ? selectedColor : colors.light.textMuted} size={20} />
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity 
                style={[styles.primaryButton, (!name.trim() || !credits.trim()) && { opacity: 0.5 }]} 
                onPress={validateAndProceedToStep2} // Validate before stepping forward
                disabled={!name.trim() || !credits.trim()}
              >
                <Text style={styles.primaryButtonText}>Next</Text>
                <ChevronRight color="#FFF" size={20} />
              </TouchableOpacity>
            </View>
          )}

          {/* STEP 2: Components & Sessions */}
          {step === 2 && (
            <View>
              <View style={styles.templateSelector}>
                <Text style={styles.templateLabel}>Course Structure</Text>
                <View style={styles.templateRow}>
                  <TouchableOpacity 
                    style={[styles.templateBtn, template === 'theory_only' && styles.templateBtnActive]} 
                    onPress={() => handleTemplateSelection('theory_only')}
                  >
                    <Text style={[styles.templateBtnText, template === 'theory_only' && styles.templateBtnTextActive]}>Theory Only</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.templateBtn, template === 'theory_lab' && styles.templateBtnActive]} 
                    onPress={() => handleTemplateSelection('theory_lab')}
                  >
                    <Text style={[styles.templateBtnText, template === 'theory_lab' && styles.templateBtnTextActive]}>Theory + Lab</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.templateBtn, template === 'theory_tutorial' && styles.templateBtnActive]} 
                    onPress={() => handleTemplateSelection('theory_tutorial')}
                  >
                    <Text style={[styles.templateBtnText, template === 'theory_tutorial' && styles.templateBtnTextActive]}>Theory + Tutorial</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {components.map((comp) => (
                <View key={comp.id} style={styles.componentCard}>
                  <View style={styles.componentHeader}>
                    <View style={styles.componentTitleRow}>
                      <BookOpen size={20} color={colors.light.primary} />
                      <Text style={styles.componentTitle}>
                        {comp.type.charAt(0).toUpperCase() + comp.type.slice(1)} Component
                      </Text>
                    </View>
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
                        <Text style={styles.inlineInputLocked}>{comp.durationMinutes} mins</Text>
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
                          <Text style={styles.sessionDayLabel}>Start Time</Text>
                          {Platform.OS === 'ios' ? (
                            <DateTimePicker
                              value={(() => {
                                const date = new Date();
                                const [h, m] = session.startTime.split(':').map(Number);
                                date.setHours(h, m, 0, 0);
                                return date;
                              })()}
                              mode="time"
                              is24Hour={false}
                              display="default"
                              onChange={(e, d) => {
                                if (d) {
                                  const hours = d.getHours().toString().padStart(2, '0');
                                  const minutes = d.getMinutes().toString().padStart(2, '0');
                                  updateSession(comp.id, session.id, { startTime: `${hours}:${minutes}` });
                                }
                              }}
                              style={{ height: 40 }}
                            />
                          ) : (
                            <TouchableOpacity 
                              style={styles.timeInput}
                              onPress={() => setActiveTimePicker({compId: comp.id, sessionId: session.id})}
                            >
                              <Text style={{textAlign: 'center', fontSize: 14, fontFamily: 'Inter', color: colors.light.text}}>
                                {session.startTime}
                              </Text>
                            </TouchableOpacity>
                          )}
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

              <TouchableOpacity 
                style={[styles.primaryButton, { marginTop: 24, marginBottom: 48 }]} 
                onPress={validateAndProceedToReview}
              >
                <Text style={styles.primaryButtonText}>Review Course</Text>
                <ChevronRight color="#FFF" size={20} />
              </TouchableOpacity>
            </View>
          )}

          {/* Android Time Picker Modal */}
          {activeTimePicker && Platform.OS === 'android' && (
            <DateTimePicker
              value={(() => {
                const session = components.find(c => c.id === activeTimePicker.compId)?.sessions.find(s => s.id === activeTimePicker.sessionId);
                const date = new Date();
                if (session) {
                  const [h, m] = session.startTime.split(':').map(Number);
                  date.setHours(h, m, 0, 0);
                }
                return date;
              })()}
              mode="time"
              is24Hour={false}
              display="default"
              onChange={handleTimeChange}
            />
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

  iconPalette: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8, marginBottom: 24 },
  iconSwatch: { width: 40, height: 40, borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.light.border },

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
  inlineInputLocked: { flex: 1, paddingVertical: 12, marginLeft: 8, fontSize: 14, color: colors.light.textMuted, fontFamily: 'Inter', fontWeight: '500' },
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

  templateSelector: { marginBottom: 24 },
  templateLabel: { fontSize: 14, fontWeight: '600', color: colors.light.text, marginBottom: 12, fontFamily: 'Inter' },
  templateRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  templateBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: colors.light.border, backgroundColor: colors.light.surface },
  templateBtnActive: { backgroundColor: colors.light.accent, borderColor: colors.light.accent },
  templateBtnText: { fontSize: 14, fontWeight: '500', color: colors.light.text, fontFamily: 'Inter' },
  templateBtnTextActive: { color: '#FFF' },

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
