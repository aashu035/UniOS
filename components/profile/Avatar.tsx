import React, { useState } from 'react';
import { Image, View } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { T } from '../uni/primitives';
import { useUni } from '../uni/theme';
import { isOwnAvatar } from '../../core/fs/names';
import { initials } from '../../domains/profile/form';

/** Absolute path of the profile photo, or null for anything this app did not write. */
function avatarUri(file: string | null | undefined): string | null {
  if (!isOwnAvatar(file) || !FileSystem.documentDirectory) return null;
  return `${FileSystem.documentDirectory.replace(/\/$/, '')}/${file}`;
}

/** Round profile photo; the initials on the primary colour when there is none. */
export function Avatar({ file, name, size = 96 }: { file: string | null | undefined; name: string | null | undefined; size?: number }) {
  const p = useUni();
  const uri = avatarUri(file);
  const [broken, setBroken] = useState(false);
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: p.primary, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      {uri && !broken ? (
        <Image source={{ uri }} style={{ width: size, height: size }} onError={() => setBroken(true)} accessibilityLabel="Profile photo" />
      ) : (
        <T w={800} c="#fff" size={Math.round(size / 3)}>{initials(name)}</T>
      )}
    </View>
  );
}
