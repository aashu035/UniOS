import * as SecureStore from 'expo-secure-store';

export type AIProvider = 'gemini' | 'openai' | 'anthropic' | 'openrouter' | 'nvidia' | 'numtron';

export type AIProviderKeys = {
  [key in AIProvider]: string | null;
};

const KEY_PREFIX = 'unios_ai_key_';

export class AIProviderKeysStore {
  static async getKeys(): Promise<AIProviderKeys> {
    const keys: AIProviderKeys = {
      gemini: null,
      openai: null,
      anthropic: null,
      openrouter: null,
      nvidia: null,
      numtron: null,
    };
    
    for (const provider of Object.keys(keys) as AIProvider[]) {
      try {
        keys[provider] = await SecureStore.getItemAsync(`${KEY_PREFIX}${provider}`);
      } catch (e) {
        console.error(`Failed to load key for ${provider}`, e);
      }
    }
    return keys;
  }

  static async saveKey(provider: AIProvider, value: string | null): Promise<void> {
    try {
      if (value && value.trim() !== '') {
        await SecureStore.setItemAsync(`${KEY_PREFIX}${provider}`, value.trim());
      } else {
        await SecureStore.deleteItemAsync(`${KEY_PREFIX}${provider}`);
      }
    } catch (e) {
      console.error(`Failed to save key for ${provider}`, e);
      throw e;
    }
  }
}
