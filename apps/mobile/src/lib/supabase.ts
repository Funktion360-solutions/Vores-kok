import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import type { Database, VKClient } from '@vores-kok/database';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { AppState, Platform } from 'react-native';

const extra = (Constants.expoConfig?.extra ?? {}) as { supabaseUrl?: string; supabaseAnonKey?: string };
const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? extra.supabaseUrl;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? extra.supabaseAnonKey;
if (!url || !anonKey) throw new Error('Supabase URL/anon key mangler (EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY).');

/**
 * Session storage in the iOS Keychain (expo-secure-store). Keychain items are
 * limited in size, so the session JSON is split into chunks.
 */
const CHUNK = 1800;
const secureStorage = {
  async getItem(key: string) {
    const count = Number(await SecureStore.getItemAsync(`${key}.n`));
    if (!count) return null;
    const parts = await Promise.all(Array.from({ length: count }, (_, i) => SecureStore.getItemAsync(`${key}.${i}`)));
    return parts.some((p) => p == null) ? null : parts.join('');
  },
  async setItem(key: string, value: string) {
    const old = Number(await SecureStore.getItemAsync(`${key}.n`)) || 0;
    const n = Math.ceil(value.length / CHUNK);
    for (let i = 0; i < n; i++) await SecureStore.setItemAsync(`${key}.${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK));
    await SecureStore.setItemAsync(`${key}.n`, String(n));
    for (let i = n; i < old; i++) await SecureStore.deleteItemAsync(`${key}.${i}`);
  },
  async removeItem(key: string) {
    const n = Number(await SecureStore.getItemAsync(`${key}.n`)) || 0;
    for (let i = 0; i < n; i++) await SecureStore.deleteItemAsync(`${key}.${i}`);
    await SecureStore.deleteItemAsync(`${key}.n`);
  },
};

export const supabase: VKClient = createClient<Database>(url, anonKey, {
  auth: {
    storage: Platform.OS === 'web' ? AsyncStorage : secureStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Only refresh tokens while the app is in the foreground (Supabase RN guidance).
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
