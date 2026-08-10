import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Save } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { colors, radius, spacing, typography } from '../../tokens';
import { useProfile } from '../../domains/profile/hooks';
import { HeroPortrait } from '../../components/avatar/HeroPortrait';

export default function EditProfile() {
  const router = useRouter();
  const { profile, isLoading, updateProfile } = useProfile();
  const [name, setName] = useState('');
  const [branch, setBranch] = useState('');
  const [enrollmentNo, setEnrollmentNo] = useState('');
  const [semester, setSemester] = useState('1');
  const [targetCgpa, setTargetCgpa] = useState('8');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setName(profile.name ?? '');
    setBranch(profile.branch ?? '');
    setEnrollmentNo(profile.enrollmentNo ?? '');
    setSemester(String(profile.currentSemester ?? 1));
    setTargetCgpa(String(profile.targetCgpa ?? 8));
    setAvatar(profile.avatar ?? null);
  }, [profile]);

  const handlePickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Denied', 'You need to allow access to your photos to set a profile picture.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });

      if (!result.canceled && result.assets[0].uri) {
        const sourceUri = result.assets[0].uri;
        const fileName = `avatar_${Date.now()}.jpg`;
        const docDir = FileSystem.documentDirectory!.replace(/\/$/, '');
        const destUri = `${docDir}/${fileName}`;

        await FileSystem.copyAsync({
          from: sourceUri,
          to: destUri,
        });

        // Delete old avatar if it exists and is a local relative file
        if (avatar && !avatar.startsWith('http') && !avatar.startsWith('file://')) {
          const oldAbsoluteUri = `${docDir}/${avatar}`;
          await FileSystem.deleteAsync(oldAbsoluteUri, { idempotent: true });
        }

        // Store relative path
        setAvatar(fileName);
      }
    } catch (err) {
      console.error('Error saving image:', err);
      Alert.alert('Error', 'Could not save the image.');
    }
  };

  const save = async () => {
    const parsedSemester = Number.parseInt(semester, 10);
    const parsedCgpa = Number.parseFloat(targetCgpa);
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter your name before saving.');
      return;
    }
    if (!Number.isInteger(parsedSemester) || parsedSemester < 1 || parsedSemester > 12) {
      Alert.alert('Check semester', 'Enter a semester between 1 and 12.');
      return;
    }
    if (!Number.isFinite(parsedCgpa) || parsedCgpa < 0 || parsedCgpa > 10) {
      Alert.alert('Check target CGPA', 'Enter a value between 0 and 10.');
      return;
    }

    setIsSaving(true);
    try {
      await updateProfile({
        name: name.trim(), branch: branch.trim() || null, enrollmentNo: enrollmentNo.trim() || null,
        currentSemester: parsedSemester, targetCgpa: parsedCgpa, avatar
      });
      router.back();
    } catch (error) {
      console.error('Could not update profile', error);
      Alert.alert('Could not save profile', 'Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const docDir = FileSystem.documentDirectory ? FileSystem.documentDirectory.replace(/\/$/, '') : '';
  const displayAvatar = avatar 
    ? (avatar.startsWith('http') || avatar.startsWith('file://') ? avatar : `${docDir}/${avatar}`)
    : null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.back()} accessibilityLabel="Go back">
          <ArrowLeft size={24} color={colors.light.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Edit profile</Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.avatarContainer}>
          <HeroPortrait imageUrl={displayAvatar} onPress={handlePickImage} size={100} />
        </View>
        <Field label="Name *" value={name} onChangeText={setName} />
        <Field label="Branch" value={branch} onChangeText={setBranch} placeholder="e.g. Computer Science" />
        <Field label="Enrollment number" value={enrollmentNo} onChangeText={setEnrollmentNo} />
        <Field label="Current semester" value={semester} onChangeText={setSemester} keyboardType="number-pad" />
        <Field label="Target CGPA" value={targetCgpa} onChangeText={setTargetCgpa} keyboardType="decimal-pad" />
      </ScrollView>
      <View style={styles.footer}>
        <TouchableOpacity style={[styles.saveButton, (isSaving || isLoading) && styles.disabled]} onPress={save} disabled={isSaving || isLoading}>
          <Save size={20} color={colors.dark.text} style={styles.saveIcon} />
          <Text style={styles.saveText}>{isSaving ? 'Saving…' : 'Save changes'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function Field({ label, placeholder, ...inputProps }: { label: string; placeholder?: string; value: string; onChangeText: (value: string) => void; autoFocus?: boolean; keyboardType?: 'default' | 'number-pad' | 'decimal-pad' }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput style={styles.input} placeholder={placeholder} placeholderTextColor={colors.light.textMuted} {...inputProps} /></View>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.light.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.light.border },
  iconButton: { padding: spacing.sm }, headerSpacer: { width: 40 }, title: { fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold, color: colors.light.text },
  content: { padding: spacing.xl }, 
  avatarContainer: { alignItems: 'center', marginBottom: spacing.xl },
  field: { marginBottom: spacing.lg }, label: { fontSize: typography.fontSize.sm, color: colors.light.text, fontWeight: typography.fontWeight.semibold, marginBottom: spacing.sm },
  input: { minHeight: 52, borderWidth: 1, borderColor: colors.light.border, backgroundColor: colors.light.surface, borderRadius: radius.lg, paddingHorizontal: spacing.lg, color: colors.light.text, fontSize: typography.fontSize.base },
  footer: { padding: spacing.xl, borderTopWidth: 1, borderTopColor: colors.light.border }, saveButton: { minHeight: 52, borderRadius: radius.xl, backgroundColor: colors.light.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }, saveIcon: { marginRight: spacing.sm }, saveText: { color: colors.dark.text, fontWeight: typography.fontWeight.bold, fontSize: typography.fontSize.base }, disabled: { opacity: 0.5 },
});
