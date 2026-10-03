import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { loadSnapshot, type Snapshot } from './snapshot';

/**
 * Loads the academic snapshot and reloads it whenever the screen regains focus.
 * Keeps showing the previous snapshot while a reload is in flight.
 */
export function useAcademic(opts?: { from?: string; to?: string }) {
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const alive = useRef(true);
  const key = `${opts?.from ?? ''}|${opts?.to ?? ''}`;

  const load = useCallback(async () => {
    try {
      const s = await loadSnapshot({ from: opts?.from, to: opts?.to });
      if (alive.current) { setData(s); setError(null); }
    } catch (e) {
      console.error('[academic] snapshot failed', e);
      if (alive.current) setError(e instanceof Error ? e : new Error(String(e)));
    }
  }, [key]);

  useEffect(() => () => { alive.current = false; }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return { data, error, reload: load, refresh, refreshing };
}

/** Minutes since local midnight, ticking every 30 s. */
export function useNowMinutes(): number {
  const read = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
  const [m, setM] = useState(read);
  useEffect(() => {
    const id = setInterval(() => setM(read()), 30000);
    return () => clearInterval(id);
  }, []);
  return m;
}
