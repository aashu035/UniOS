import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Avatar } from '../../components/profile/Avatar';
import { changeProfilePhoto } from '../../components/profile/photo';
import { Icon, type IconName } from '../../components/uni/Icon';
import { ListCard, T, Tap, Well } from '../../components/uni/primitives';
import { FormPage } from '../../components/uni/form';
import { Sheet } from '../../components/uni/Sheet';
import { useToast } from '../../components/uni/Toast';
import { useUni } from '../../components/uni/theme';
import { semesterLine, semesterTitle } from '../../domains/profile/form';
import { ProfileRepository } from '../../domains/profile/repository';
import { SemesterRepository } from '../../domains/semester/repository';

type Profile = Awaited<ReturnType<typeof ProfileRepository.getProfile>>;
type Sem = Awaited<ReturnType<typeof SemesterRepository.listWithCourseCounts>>[number];

/** Profile (design UniProfile, handoff §4): photo, name, branch, one facts card, two links. */
export default function ProfileScreen() {
  const p = useUni();
  const router = useRouter();
  const toast = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sems, setSems] = useState<Sem[]>([]);
  const [photoSheet, setPhotoSheet] = useState(false);

  const load = useCallback(async () => {
    const [pr, ss] = await Promise.all([ProfileRepository.getProfile(), SemesterRepository.listWithCourseCounts()]);
    setProfile(pr ?? null); setSems(ss);
  }, []);
  useFocusEffect(useCallback(() => { load().catch((e) => console.error('Could not load profile', e)); }, [load]));

  const active = sems.find((s) => s.isActive);
  const photo = async (from: 'camera' | 'library' | null) => {
    setPhotoSheet(false);
    if (!profile) return;
    const r = await changeProfilePhoto(profile.id, profile.avatar, from);
    if (r.ok) { toast.show(from ? 'Photo updated.' : 'Photo removed.'); load(); }
    else if (r.reason === 'denied') toast.show(from === 'camera' ? 'Camera access is off. Turn it on in Settings → Apps → UniOS.' : 'Photo access is off. Turn it on in Settings → Apps → UniOS.');
    else if (r.reason === 'failed') toast.show(`Could not save the photo. ${r.message ?? ''}`.trim());
  };

  const facts: Array<[string, string, boolean]> = [
    ['Enrollment number', profile?.enrollmentNo || 'Not added', !!profile?.enrollmentNo],
    ['Current semester', active ? semesterLine(active) : 'None active', false],
    ['Target CGPA', profile?.targetCgpa != null ? String(profile.targetCgpa) : 'Not set', profile?.targetCgpa != null],
  ];
  const links: Array<[IconName, string, string, string]> = [
    ['layers', 'Semesters', `${sems.length} semester${sems.length === 1 ? '' : 's'}${active ? ` · ${semesterTitle(active)} active` : ''}`, '/semester'],
    ['hard-drive-download', 'Backup & export', 'Save a copy, restore it, or clear data', '/settings/data'],
  ];

  return (
    <FormPage title="Profile" backIcon="chevron-left" onBack={() => router.back()} gap={14}
      right={profile ? (
        <Tap onPress={() => router.push('/profile/edit')} accessibilityRole="button" accessibilityLabel="Edit profile"
          style={{ height: 44, paddingHorizontal: 16, borderRadius: 22, backgroundColor: p.elev, borderWidth: 1, borderColor: p.hair, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name="pencil" size={15} color={p.text} />
          <T w={800} size={13.5}>Edit</T>
        </Tap>
      ) : undefined}>
      {profile ? (
        <>
          <View style={{ alignItems: 'center', gap: 10, paddingTop: 8, paddingBottom: 4 }}>
            <Tap onPress={() => setPhotoSheet(true)} accessibilityRole="button" accessibilityLabel={profile.avatar ? 'Change profile photo' : 'Add profile photo'}>
              <Avatar file={profile.avatar} name={profile.name} size={96} />
              <View style={{ position: 'absolute', right: 0, bottom: 0, width: 32, height: 32, borderRadius: 16, backgroundColor: p.elev, borderWidth: 1, borderColor: p.hair, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="camera" size={15} color={p.text} />
              </View>
            </Tap>
            <T w={800} size={22} style={{ letterSpacing: -0.5, lineHeight: 28, textAlign: 'center' }}>{profile.name}</T>
            {profile.branch ? <T w={600} c={p.muted} size={14} style={{ lineHeight: 20, textAlign: 'center' }}>{profile.branch}</T> : null}
          </View>

          <ListCard>
            {facts.map(([l, v, mono]) => (
              <View key={l} style={{ minHeight: 56, paddingVertical: 8, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <T w={600} c={p.muted} size={13.5} style={{ flex: 1 }}>{l}</T>
                <T w={800} size={14.5} style={[{ textAlign: 'right', flexShrink: 1 }, mono ? { fontFamily: 'JetBrainsMono_700Bold' } : null]}>{v}</T>
              </View>
            ))}
          </ListCard>

          <ListCard>
            {links.map(([icon, t, d, to]) => (
              <Tap key={t} onPress={() => router.push(to as any)} accessibilityRole="button"
                style={{ minHeight: 60, paddingVertical: 8, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Well icon={icon} color={p.text} bg={p.surface} size={36} radius={11} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T w={700} size={14.5}>{t}</T>
                  <T w={600} c={p.muted} size={12} style={{ marginTop: 1 }} numberOfLines={1}>{d}</T>
                </View>
                <Icon name="chevron-right" size={16} color={p.muted} />
              </Tap>
            ))}
          </ListCard>
        </>
      ) : null}

      <Sheet visible={photoSheet} onClose={() => setPhotoSheet(false)} title="Profile photo"
        rows={[
          { icon: 'camera', label: 'Camera', onPress: () => photo('camera') },
          { icon: 'images', label: 'Photos', onPress: () => photo('library') },
          ...(profile?.avatar ? [{ icon: 'trash-2' as const, label: 'Remove photo', danger: true, onPress: () => photo(null) }] : []),
        ]} />
    </FormPage>
  );
}
