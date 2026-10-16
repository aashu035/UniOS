import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { isOwnAvatar } from '../../core/fs/names';
import { ProfileRepository } from '../../domains/profile/repository';

export type PhotoResult = { ok: true; file: string | null } | { ok: false; reason: 'cancelled' | 'denied' | 'failed'; message?: string };

const docDir = () => (FileSystem.documentDirectory ?? '').replace(/\/$/, '');

/**
 * Take or pick a square profile photo, copy it into the app as avatar_<time>.jpg,
 * save it on the profile, and delete the old one (only a file this app wrote).
 * `from: null` removes the photo.
 */
export async function changeProfilePhoto(profileId: number, current: string | null | undefined, from: 'camera' | 'library' | null): Promise<PhotoResult> {
  let file: string | null = null;
  if (from) {
    const perm = from === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return { ok: false, reason: 'denied' };
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.6 };
    const res = from === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (res.canceled || !res.assets?.[0]?.uri) return { ok: false, reason: 'cancelled' };
    file = `avatar_${Date.now()}.jpg`;
    try {
      await FileSystem.copyAsync({ from: res.assets[0].uri, to: `${docDir()}/${file}` });
    } catch (e: any) {
      return { ok: false, reason: 'failed', message: e?.message };
    }
  }
  try {
    await ProfileRepository.updateProfile(profileId, { avatar: file });
  } catch (e: any) {
    if (file) await FileSystem.deleteAsync(`${docDir()}/${file}`, { idempotent: true }).catch(() => {});
    return { ok: false, reason: 'failed', message: e?.message };
  }
  if (isOwnAvatar(current) && current !== file) await FileSystem.deleteAsync(`${docDir()}/${current}`, { idempotent: true }).catch(() => {});
  return { ok: true, file };
}
