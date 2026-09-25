/**
 * Deliberate offline cache for recipes (docs/mobile/offline.md).
 *
 * - The whole household's recipe documents (get_recipe shape) are mirrored in
 *   device storage, keyed by household. Reads always come from this mirror, so
 *   the app works identically online and offline.
 * - Sync is incremental: documents updated since the last sync (minus a clock
 *   skew margin) are pulled, then deletions are detected by comparing ids.
 * - Personal writes that are safe to replay (favorites) go into a persisted
 *   outbox and are replayed when connectivity returns. Recipe edits require a
 *   connection in Phase 1; unsaved edits are kept as local drafts instead.
 */
import type { RecipeDocument } from '@vores-kok/validation';

export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface RemoteSource {
  fetchSince(householdId: string, since: string | null, limit: number): Promise<RecipeDocument[]>;
  listIds(householdId: string): Promise<string[]>;
  setFavorite(recipeId: string, favorite: boolean): Promise<void>;
}

export type OutboxOp = { kind: 'favorite'; recipeId: string; favorite: boolean; at: string };

interface Snapshot {
  version: 1;
  syncedAt: string | null;
  docs: Record<string, RecipeDocument>;
}

const PAGE = 200;
const SKEW_MS = 5 * 60 * 1000;

export class RecipeCache {
  private snapshot: Snapshot = { version: 1, syncedAt: null, docs: {} };
  private outbox: OutboxOp[] = [];
  private listeners = new Set<() => void>();
  private syncing: Promise<void> | null = null;

  constructor(private readonly store: KeyValueStore, private readonly remote: RemoteSource, readonly householdId: string) {}

  private get key() { return `vk:v1:recipes:${this.householdId}`; }
  private get outboxKey() { return `vk:v1:outbox:${this.householdId}`; }

  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => this.listeners.delete(fn); };
  private revision = 0;
  private allMemo: { rev: number; list: RecipeDocument[] } = { rev: -1, list: [] };
  private emit() { this.revision++; for (const l of this.listeners) l(); }

  get syncedAt() { return this.snapshot.syncedAt; }
  get pendingWrites() { return this.outbox.length; }
  /** Stable array between changes (safe for useSyncExternalStore). */
  all(): RecipeDocument[] {
    if (this.allMemo.rev !== this.revision) this.allMemo = { rev: this.revision, list: Object.values(this.snapshot.docs) };
    return this.allMemo.list;
  }
  get(id: string): RecipeDocument | undefined { return this.snapshot.docs[id]; }

  async load(): Promise<void> {
    try {
      const raw = await this.store.getItem(this.key);
      if (raw) {
        const parsed = JSON.parse(raw) as Snapshot;
        if (parsed.version === 1) this.snapshot = parsed;
      }
      const ob = await this.store.getItem(this.outboxKey);
      if (ob) this.outbox = JSON.parse(ob) as OutboxOp[];
      // Re-apply pending local changes on top of the stored snapshot.
      for (const op of this.outbox) this.applyLocal(op);
    } catch {
      // Corrupt cache: start over; the next sync repopulates it.
      this.snapshot = { version: 1, syncedAt: null, docs: {} };
    }
    this.emit();
  }

  private async persist() {
    await this.store.setItem(this.key, JSON.stringify(this.snapshot));
    await this.store.setItem(this.outboxKey, JSON.stringify(this.outbox));
  }

  /** Stores a freshly fetched document (e.g. after opening or saving a recipe online). */
  async put(doc: RecipeDocument) {
    this.snapshot.docs[doc.id] = this.withPending(doc);
    await this.persist();
    this.emit();
  }

  async remove(id: string) {
    delete this.snapshot.docs[id];
    await this.persist();
    this.emit();
  }

  private withPending(doc: RecipeDocument): RecipeDocument {
    const fav = [...this.outbox].reverse().find((o) => o.kind === 'favorite' && o.recipeId === doc.id);
    return fav ? { ...doc, is_favorite: fav.favorite } : doc;
  }

  private applyLocal(op: OutboxOp) {
    const d = this.snapshot.docs[op.recipeId];
    if (d && op.kind === 'favorite') this.snapshot.docs[op.recipeId] = { ...d, is_favorite: op.favorite };
  }

  /** Optimistic favorite: applied locally at once, sent now or when back online. */
  async setFavorite(recipeId: string, favorite: boolean) {
    const op: OutboxOp = { kind: 'favorite', recipeId, favorite, at: new Date().toISOString() };
    this.outbox = [...this.outbox.filter((o) => !(o.kind === 'favorite' && o.recipeId === recipeId)), op];
    this.applyLocal(op);
    await this.persist();
    this.emit();
    await this.flush().catch(() => undefined);
  }

  /** Replays the outbox in order. Stops at the first network failure (keeps the rest). */
  async flush() {
    while (this.outbox.length) {
      const op = this.outbox[0]!;
      try {
        await this.remote.setFavorite(op.recipeId, op.favorite);
      } catch (e) {
        const code = (e as { code?: string }).code;
        // Permanent errors (recipe deleted / access revoked) drop the op; network errors keep it.
        if (code && code !== 'NETWORK' && code !== 'UNKNOWN') { this.outbox.shift(); await this.persist(); continue; }
        throw e;
      }
      this.outbox.shift();
      await this.persist();
    }
    this.emit();
  }

  /** Incremental pull + deletion detection. Concurrent calls share one run. */
  sync(): Promise<void> {
    this.syncing ??= this.doSync().finally(() => { this.syncing = null; });
    return this.syncing;
  }

  private async doSync() {
    await this.flush().catch(() => undefined);
    const started = new Date();
    const since = this.snapshot.syncedAt ? new Date(new Date(this.snapshot.syncedAt).getTime() - SKEW_MS).toISOString() : null;
    let cursor = since;
    for (;;) {
      const page = await this.remote.fetchSince(this.householdId, cursor, PAGE);
      for (const d of page) this.snapshot.docs[d.id] = this.withPending(d);
      if (page.length < PAGE) break;
      const last = page[page.length - 1]!.updated_at;
      if (last === cursor) break; // guard against a page of identical timestamps
      cursor = last;
    }
    const ids = new Set(await this.remote.listIds(this.householdId));
    for (const id of Object.keys(this.snapshot.docs)) if (!ids.has(id)) delete this.snapshot.docs[id];
    this.snapshot.syncedAt = started.toISOString();
    await this.persist();
    this.emit();
  }

  async clear() {
    this.snapshot = { version: 1, syncedAt: null, docs: {} };
    this.outbox = [];
    await this.store.removeItem(this.key);
    await this.store.removeItem(this.outboxKey);
    this.emit();
  }
}
