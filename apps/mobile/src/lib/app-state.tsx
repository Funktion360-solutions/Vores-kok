import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import type { Session } from '@supabase/supabase-js';
import {
  getRecipesSince,
  listCategories,
  listMyHouseholds,
  listPeople,
  listRecipeIds,
  setFavorite,
  toDataError,
  type Category,
  type Household,
  type Person,
} from '@vores-kok/database';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { RecipeCache } from './recipe-cache';
import { supabase } from './supabase';

const ACTIVE_KEY = 'vk:v1:activeHousehold';
const HOUSEHOLDS_KEY = 'vk:v1:households';
const refKey = (h: string) => `vk:v1:ref:${h}`;

interface AppContextValue {
  ready: boolean;
  session: Session | null;
  households: Household[];
  household: Household | null;
  switchHousehold: (id: string) => Promise<void>;
  refreshHouseholds: () => Promise<Household[]>;
  cache: RecipeCache | null;
  online: boolean;
  syncing: boolean;
  syncError: string | null;
  sync: () => Promise<void>;
  categories: Category[];
  people: Person[];
  refreshReference: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hhReady, setHhReady] = useState(false);
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const cacheRef = useRef<RecipeCache | null>(null);
  const [cacheVersion, setCacheVersion] = useState(0);

  // ── Auth ──
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthReady(true); });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  // ── Connectivity ──
  useEffect(() => NetInfo.addEventListener((s) => setOnline(s.isConnected !== false && s.isInternetReachable !== false)), []);

  const refreshHouseholds = useCallback(async () => {
    const list = await listMyHouseholds(supabase);
    setHouseholds(list);
    await AsyncStorage.setItem(HOUSEHOLDS_KEY, JSON.stringify(list));
    return list;
  }, []);

  // ── Households: cached for offline start, refreshed when online ──
  useEffect(() => {
    if (!session) { setHouseholds([]); setActiveId(null); setHhReady(authReady); return; }
    let cancelled = false;
    setHhReady(false);
    (async () => {
      const [cached, active] = await Promise.all([AsyncStorage.getItem(HOUSEHOLDS_KEY), AsyncStorage.getItem(ACTIVE_KEY)]);
      if (cached && !cancelled) setHouseholds(JSON.parse(cached) as Household[]);
      if (active && !cancelled) setActiveId(active);
      try { if (!cancelled) await refreshHouseholds(); } catch { /* offline: keep cached list */ }
      if (!cancelled) setHhReady(true);
    })();
    return () => { cancelled = true; };
  }, [session, authReady, refreshHouseholds]);

  const household = useMemo(() => households.find((h) => h.id === activeId) ?? households[0] ?? null, [households, activeId]);

  // ── Recipe cache per household ──
  useEffect(() => {
    if (!household) { cacheRef.current = null; setCacheVersion((v) => v + 1); return; }
    const cache = new RecipeCache(AsyncStorage, {
      fetchSince: (h, since, limit) => getRecipesSince(supabase, h, since, limit),
      listIds: (h) => listRecipeIds(supabase, h),
      setFavorite: async (id, fav) => { await setFavorite(supabase, id, fav); },
    }, household.id);
    cacheRef.current = cache;
    setCacheVersion((v) => v + 1);
    cache.load().then(() => undefined);
    AsyncStorage.getItem(refKey(household.id)).then((raw) => {
      if (!raw) return;
      const r = JSON.parse(raw) as { categories: Category[]; people: Person[] };
      setCategories(r.categories);
      setPeople(r.people);
    });
  }, [household]);

  const refreshReference = useCallback(async () => {
    if (!household) return;
    const [cats, ppl] = await Promise.all([listCategories(supabase, household.id), listPeople(supabase, household.id)]);
    setCategories(cats);
    setPeople(ppl);
    await AsyncStorage.setItem(refKey(household.id), JSON.stringify({ categories: cats, people: ppl }));
  }, [household]);

  const sync = useCallback(async () => {
    const cache = cacheRef.current;
    if (!cache) return;
    setSyncing(true);
    try {
      await cache.sync();
      await refreshReference();
      setSyncError(null);
    } catch (e) {
      setSyncError(toDataError(e).message);
    } finally {
      setSyncing(false);
    }
  }, [refreshReference]);

  // Sync on household change, on reconnect and when returning to the foreground.
  useEffect(() => { if (household && online) void sync(); }, [household, online, sync, cacheVersion]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') void sync(); });
    return () => sub.remove();
  }, [sync]);

  const switchHousehold = useCallback(async (id: string) => {
    await AsyncStorage.setItem(ACTIVE_KEY, id);
    setActiveId(id);
  }, []);

  const signOut = useCallback(async () => {
    // Remove all cached household data from the device on sign-out (privacy).
    const keys = await AsyncStorage.getAllKeys();
    await AsyncStorage.multiRemove(keys.filter((k) => k.startsWith('vk:')));
    await supabase.auth.signOut();
  }, []);

  const value: AppContextValue = {
    ready: authReady && (!session || hhReady),
    session, households, household, switchHousehold, refreshHouseholds,
    cache: cacheRef.current, online, syncing, syncError, sync, categories, people, refreshReference, signOut,
  };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}

const EMPTY: never[] = [];
/** All cached recipe documents of the active household (re-renders on change). */
export function useCachedRecipes() {
  const { cache } = useApp();
  const subscribe = useCallback((fn: () => void) => (cache ? cache.subscribe(fn) : () => undefined), [cache]);
  return useSyncExternalStore(subscribe, () => (cache ? cache.all() : EMPTY));
}
