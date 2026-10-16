import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Avatar } from '../../components/profile/Avatar';
import { changeProfilePhoto } from '../../components/profile/photo';
import { T, Tap } from '../../components/uni/primitives';
import { Field, FormPage, Input, PrimaryButton } from '../../components/uni/form';
import { Sheet } from '../../components/uni/Sheet';
import { useToast } from '../../components/uni/Toast';
import { useUni } from '../../components/uni/theme';
import { validateProfile, type ProfileDraft } from '../../domains/profile/form';
import { ProfileRepository } from '../../domains/profile/repository';

type Profile = Awaited<ReturnType<typeof ProfileRepository.getProfile>>;

const FIELDS: Array<{ k: keyof ProfileDraft; label: string; placeholder: string; hint?: string; keyboard?: 'default' | 'number-pad' | 'decimal-pad'; caps?: 'words' | 'characters' }> = [
  { k: 'name', label: 'Name', placeholder: 'Your name', caps: 'words' },
  { k: 'branch', label: 'Branch', placeholder: 'e.g. B.Tech CSE', caps: 'words' },
  { k: 'enrollment', label: 'Enrollment number', placeholder: 'e.g. 23001001018', hint: 'Optional · as on your ID card', caps: 'characters' },
  { k: 'target', label: 'Target CGPA', placeholder: 'e.g. 8.5', hint: 'Optional · shown with your semester SGPAs', keyboard: 'decimal-pad' },
];

/** Edit profile (handoff §4). Errors show after the first Save, then update as you type. */
export default function EditProfile() {
  const p = useUni();
  const router = useRouter();
  const toast = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [draft, setDraft] = useState<ProfileDraft>({ name: '', branch: '', enrollment: '', target: '' });
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photoSheet, setPhotoSheet] = useState(false);

  useEffect(() => {
    ProfileRepository.getProfile().then((pr) => {
      if (!pr) return;
      setProfile(pr);
      setDraft({ name: pr.name ?? '', branch: pr.branch ?? '', enrollment: pr.enrollmentNo ?? '', target: pr.targetCgpa != null ? String(pr.targetCgpa) : '' });
    }).catch((e) => console.error('Could not load profile', e));
  }, []);

  const { errors, values } = validateProfile(draft);
  const save = async () => {
    setTried(true);
    if (!values || !profile) return;
    setSaving(true);
    try {
      await ProfileRepository.updateProfile(profile.id, values);
      toast.show('Profile saved.');
      router.back();
    } catch (e: any) {
      console.error('Could not update profile', e);
      toast.show('Could not save the profile. Try again.');
      setSaving(false);
    }
  };

  const photo = async (from: 'camera' | 'library' | null) => {
    setPhotoSheet(false);
    if (!profile) return;
    const r = await changeProfilePhoto(profile.id, profile.avatar, from);
    if (r.ok) { setProfile({ ...profile, avatar: r.file, heroPortraitUri: r.file }); toast.show(from ? 'Photo updated.' : 'Photo removed.'); }
    else if (r.reason === 'denied') toast.show('Access is off. Turn it on in Settings → Apps → UniOS.');
    else if (r.reason === 'failed') toast.show('Could not save the photo.');
  };

  return (
    <FormPage title="Edit profile" onBack={() => router.back()} gap={14}
      footer={<PrimaryButton label="Save" onPress={save} busy={saving} disabled={!profile} />}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Tap onPress={() => setPhotoSheet(true)} accessibilityRole="button" accessibilityLabel="Profile photo">
          <Avatar file={profile?.avatar} name={draft.name || profile?.name} size={64} />
        </Tap>
        <Tap onPress={() => setPhotoSheet(true)} accessibilityRole="button"
          style={{ height: 44, paddingHorizontal: 14, borderRadius: 13, backgroundColor: p.surface, justifyContent: 'center' }}>
          <T w={800} size={13.5}>{profile?.avatar ? 'Change photo' : 'Add photo'}</T>
        </Tap>
      </View>

      {FIELDS.map((f) => (
        <Field key={f.k} label={f.label} error={tried ? errors[f.k] : null} hint={f.hint}>
          <Input value={draft[f.k]} onChangeText={(v) => setDraft((d) => ({ ...d, [f.k]: v }))} placeholder={f.placeholder}
            invalid={tried && !!errors[f.k]} keyboardType={f.keyboard ?? 'default'} autoCapitalize={f.caps ?? 'none'} accessibilityLabel={f.label}
            style={[{ minHeight: 50, borderRadius: 13 }, (f.k === 'target' || f.k === 'enrollment') && draft[f.k] ? { fontFamily: 'JetBrainsMono_700Bold' } : null]} />
        </Field>
      ))}

      <Sheet visible={photoSheet} onClose={() => setPhotoSheet(false)} title="Profile photo"
        rows={[
          { icon: 'camera', label: 'Camera', onPress: () => photo('camera') },
          { icon: 'images', label: 'Photos', onPress: () => photo('library') },
          ...(profile?.avatar ? [{ icon: 'trash-2' as const, label: 'Remove photo', danger: true, onPress: () => photo(null) }] : []),
        ]} />
    </FormPage>
  );
}
