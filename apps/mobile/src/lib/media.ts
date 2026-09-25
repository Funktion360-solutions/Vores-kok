import AsyncStorage from '@react-native-async-storage/async-storage';
import { signMediaUrls } from '@vores-kok/database';
import { useEffect, useState } from 'react';
import { supabase } from './supabase';

/**
 * Signed URLs for private media. The last URL per object is remembered so
 * that, offline, expo-image can still serve the file from its disk cache
 * (images are cached under `cacheKey` = storage path, not the expiring URL).
 */
const KEY = 'vk:v1:signed';
const TTL = 60 * 60 * 24; // seconds
type Entry = { url: string; exp: number };
let memory: Record<string, Entry> | null = null;
let pending: Promise<void> | null = null;

async function loadMemory() {
  if (memory) return memory;
  try { memory = JSON.parse((await AsyncStorage.getItem(KEY)) ?? '{}') as Record<string, Entry>; } catch { memory = {}; }
  return memory;
}

export async function signPaths(paths: string[]): Promise<Record<string, Entry>> {
  const mem = await loadMemory();
  const now = Date.now() / 1000;
  const need = [...new Set(paths)].filter((p) => !mem[p] || mem[p]!.exp - now < 600);
  if (need.length) {
    try {
      const fresh = await signMediaUrls(supabase, need, TTL);
      for (const [p, url] of Object.entries(fresh)) mem[p] = { url, exp: now + TTL };
      pending ??= AsyncStorage.setItem(KEY, JSON.stringify(mem)).finally(() => { pending = null; });
    } catch {
      // Offline: fall back to the last known (possibly expired) URL + disk cache.
    }
  }
  return mem;
}

export function useMediaSources(paths: Array<string | null | undefined>) {
  const list = paths.filter((p): p is string => Boolean(p));
  const key = list.join('|');
  const [map, setMap] = useState<Record<string, Entry>>({});
  useEffect(() => {
    let alive = true;
    if (list.length) void signPaths(list).then((m) => { if (alive) setMap({ ...m }); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return (path: string | null | undefined) => (path && map[path] ? { uri: map[path]!.url, cacheKey: path } : undefined);
}
