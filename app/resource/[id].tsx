import { useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ResourceRepository } from '../../domains/resource/repository';

/**
 * /resource/<id> is the address every list and search result uses. It sends a
 * note to the note screen and everything else (files, links) to the viewer.
 */
export default function ResourceRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  useEffect(() => {
    const row = /^\d+$/.test(id ?? '') ? ResourceRepository.get(Number(id)) : undefined;
    if (row?.type === 'note') router.replace(`/note/${row.id}` as any);
    else router.replace({ pathname: '/resource/viewer', params: { id: String(id) } });
  }, [id, router]);
  return null;
}
