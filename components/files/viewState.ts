import { useCallback, useRef } from 'react';
import { Prefs } from '../../core/settings/prefs';
import type { Bookmark } from '../../domains/resource/viewer';

/** What the viewers remember per file: where a PDF, video or recording was left, night mode, speed, bookmarks. */
export type ViewState = { page?: number; night?: boolean; pos?: number; speed?: number; wrap?: boolean; bookmarks?: Bookmark[] };

const key = (id: number) => `view.${id}`;

export function useViewState(id: number) {
  const cache = useRef<ViewState | null>(null);
  const get = useCallback((): ViewState => (cache.current ??= Prefs.getJSON<ViewState>(key(id), {})), [id]);
  const set = useCallback((patch: Partial<ViewState>) => {
    cache.current = { ...get(), ...patch };
    Prefs.setJSON(key(id), cache.current);
  }, [id, get]);
  return { get, set };
}
