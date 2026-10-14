import * as SecureStore from 'expo-secure-store';

/**
 * The Gemini API key used by the timetable scanner. Stored only on this device.
 * The SecureStore name is unchanged from the old multi-provider store, so keys
 * saved before still work.
 */
const STORE_KEY = 'unios_ai_key_gemini';

export const GeminiKey = {
  async get(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(STORE_KEY);
    } catch (e) {
      console.error('Failed to load the Gemini key', e);
      return null;
    }
  },

  /** An empty value removes the key. */
  async save(value: string | null): Promise<void> {
    const v = value?.trim();
    if (v) await SecureStore.setItemAsync(STORE_KEY, v);
    else await SecureStore.deleteItemAsync(STORE_KEY);
  },
};
