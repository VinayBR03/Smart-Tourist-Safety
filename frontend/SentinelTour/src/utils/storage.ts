import * as SecureStore from 'expo-secure-store';

export const SecureStorage = {
  async set(key: string, value: string): Promise<void> {
    await SecureStore.setItemAsync(key, value);
  },

  async get(key: string): Promise<string | null> {
    return await SecureStore.getItemAsync(key);
  },

  async remove(key: string): Promise<void> {
    await SecureStore.deleteItemAsync(key);
  },

  async clear(keys: string[]): Promise<void> {
    await Promise.all(keys.map((k) => SecureStore.deleteItemAsync(k)));
  },
};