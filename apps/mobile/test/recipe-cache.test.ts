import type { RecipeDocument } from '@vores-kok/validation';
import { describe, expect, it } from 'vitest';
import { RecipeCache, type KeyValueStore, type RemoteSource } from '../src/lib/recipe-cache';

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: async (k) => data.get(k) ?? null, setItem: async (k, v) => { data.set(k, v); }, removeItem: async (k) => { data.delete(k); } };
}

const doc = (id: string, updated: string, extra: Partial<RecipeDocument> = {}) => ({ id, title: id, updated_at: updated, is_favorite: false, ...extra }) as RecipeDocument;

function fakeRemote(docs: RecipeDocument[]) {
  const state = { docs, online: true, favCalls: [] as Array<[string, boolean]> };
  const remote: RemoteSource = {
    async fetchSince(_h, since, limit) {
      if (!state.online) throw Object.assign(new Error('offline'), { code: 'NETWORK' });
      return state.docs.filter((d) => !since || d.updated_at > since).sort((a, b) => a.updated_at.localeCompare(b.updated_at)).slice(0, limit);
    },
    async listIds() { if (!state.online) throw Object.assign(new Error('offline'), { code: 'NETWORK' }); return state.docs.map((d) => d.id); },
    async setFavorite(id, fav) {
      if (!state.online) throw Object.assign(new Error('offline'), { code: 'NETWORK' });
      state.favCalls.push([id, fav]);
      state.docs = state.docs.map((d) => (d.id === id ? { ...d, is_favorite: fav } : d));
    },
  };
  return { remote, state };
}

describe('RecipeCache', () => {
  it('syncs, persists and reloads while offline', async () => {
    const store = memoryStore();
    const { remote, state } = fakeRemote([doc('a', '2026-01-01T00:00:00Z'), doc('b', '2026-01-02T00:00:00Z')]);
    const cache = new RecipeCache(store, remote, 'h1');
    await cache.load();
    await cache.sync();
    expect(cache.all().map((d) => d.id).sort()).toEqual(['a', 'b']);
    state.online = false;
    const again = new RecipeCache(store, remote, 'h1');
    await again.load();
    expect(again.all()).toHaveLength(2);
    await expect(again.sync()).rejects.toThrow('offline');
    expect(again.all()).toHaveLength(2);
  });

  it('removes deleted recipes and picks up updates', async () => {
    const store = memoryStore();
    const { remote, state } = fakeRemote([doc('a', '2026-01-01T00:00:00Z'), doc('b', '2026-01-02T00:00:00Z')]);
    const cache = new RecipeCache(store, remote, 'h1');
    await cache.sync();
    state.docs = [doc('b', new Date().toISOString(), { title: 'B2' })];
    await cache.sync();
    expect(cache.all().map((d) => d.title)).toEqual(['B2']);
  });

  it('queues favorites offline and replays them later', async () => {
    const store = memoryStore();
    const { remote, state } = fakeRemote([doc('a', '2026-01-01T00:00:00Z')]);
    const cache = new RecipeCache(store, remote, 'h1');
    await cache.sync();
    state.online = false;
    await cache.setFavorite('a', true);
    expect(cache.get('a')?.is_favorite).toBe(true);
    expect(cache.pendingWrites).toBe(1);
    // App restarts while offline: the pending change survives.
    const restarted = new RecipeCache(store, remote, 'h1');
    await restarted.load();
    expect(restarted.get('a')?.is_favorite).toBe(true);
    expect(restarted.pendingWrites).toBe(1);
    state.online = true;
    await restarted.sync();
    expect(state.favCalls).toEqual([['a', true]]);
    expect(restarted.pendingWrites).toBe(0);
    expect(restarted.get('a')?.is_favorite).toBe(true);
  });

  it('pages through large collections', async () => {
    const many = Array.from({ length: 450 }, (_, i) => doc(`r${i}`, new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString()));
    const { remote } = fakeRemote(many);
    const cache = new RecipeCache(memoryStore(), remote, 'h1');
    await cache.sync();
    expect(cache.all()).toHaveLength(450);
  });
});
