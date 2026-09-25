'use client';
import {
  archiveShoppingList, clearCheckedItems, deleteShoppingItem, deleteShoppingList, listShoppingItems, parseShoppingInput, renameShoppingList,
  setShoppingItemChecked, toDataError, upsertShoppingItems, type ShoppingItem,
} from '@vores-kok/database';
import { formatQuantity, SHOPPING_CATEGORY_LABELS, SHOPPING_CATEGORY_ORDER, type ShoppingCategory } from '@vores-kok/domain';
import type { Tables } from '@vores-kok/database';
import clsx from 'clsx';
import { Check, Pencil, Plus, Trash2, Wifi, WifiOff } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { getBrowserClient } from '@/lib/supabase/client';
import { Alert, Button, Input, Select } from '../ui';

const POLL_MS = 15_000;

/**
 * Live shopping list. Every change is written to PostgreSQL first (source of
 * truth); Supabase Realtime pushes other members' changes, and a periodic
 * refetch covers dropped websocket connections.
 */
export function ShoppingListView({ list, initialItems, canEdit }: { list: Tables<'shopping_lists'>; initialItems: ShoppingItem[]; canEdit: boolean }) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [live, setLive] = useState<'connecting' | 'live' | 'polling'>('connecting');
  const [text, setText] = useState('');
  const [error, setError] = useState<string>();
  const [editingName, setEditingName] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const inFlight = useRef(0);

  const refetch = useCallback(async () => {
    if (inFlight.current > 0) return; // don't overwrite optimistic state mid-write
    try { setItems(await listShoppingItems(getBrowserClient(), list.id)); } catch { /* keep current view */ }
  }, [list.id]);

  useEffect(() => {
    const db = getBrowserClient();
    const channel = db.channel(`shopping:${list.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shopping_list_items', filter: `list_id=eq.${list.id}` }, (payload) => {
        setItems((cur) => {
          if (payload.eventType === 'DELETE') return cur.filter((i) => i.id !== (payload.old as { id: string }).id);
          const row = payload.new as ShoppingItem;
          const exists = cur.some((i) => i.id === row.id);
          return exists ? cur.map((i) => (i.id === row.id ? row : i)) : [...cur, row];
        });
      })
      .subscribe((status) => setLive(status === 'SUBSCRIBED' ? 'live' : status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED' ? 'polling' : 'connecting'));
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void refetch(); }, POLL_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') void refetch(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); void db.removeChannel(channel); };
  }, [list.id, refetch]);

  const write = async (optimistic: (cur: ShoppingItem[]) => ShoppingItem[], fn: () => Promise<void>) => {
    const before = items;
    setItems(optimistic);
    inFlight.current++;
    try { await fn(); setError(undefined); } catch (e) { setItems(before); setError(toDataError(e).message); } finally { inFlight.current--; }
  };

  const toggle = (it: ShoppingItem) => write(
    (cur) => cur.map((i) => (i.id === it.id ? { ...i, checked: !i.checked } : i)),
    () => setShoppingItemChecked(getBrowserClient(), it.id, !it.checked),
  );

  const add = () => {
    const t = text.trim();
    if (!t) return;
    const item = { ...parseShoppingInput(t), id: crypto.randomUUID(), position: items.reduce((m, i) => Math.max(m, i.position), 0) + 1 };
    setText('');
    void write(
      (cur) => [...cur, { ...item, list_id: list.id, household_id: list.household_id, checked: false, checked_at: null, checked_by: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), created_by: null, name_normalized: item.name.toLowerCase() } as ShoppingItem],
      () => upsertShoppingItems(getBrowserClient(), list.id, [item]),
    );
  };

  const groups = useMemo(() => {
    const open = items.filter((i) => !i.checked);
    const by = new Map<string, ShoppingItem[]>();
    for (const i of open) by.set(i.category, [...(by.get(i.category) ?? []), i]);
    return SHOPPING_CATEGORY_ORDER.filter((c) => by.has(c)).map((c) => ({ category: c, items: by.get(c)!.sort((a, b) => a.position - b.position || a.name.localeCompare(b.name, 'da')) }))
      .concat([...by.keys()].filter((c) => !SHOPPING_CATEGORY_ORDER.includes(c as ShoppingCategory)).map((c) => ({ category: c as ShoppingCategory, items: by.get(c)! })));
  }, [items]);
  const checked = items.filter((i) => i.checked);

  const amount = (i: ShoppingItem) => [i.quantity != null ? formatQuantity(Number(i.quantity)) : '', i.unit ?? ''].filter(Boolean).join(' ');

  const row = (i: ShoppingItem) => (
    <li key={i.id} className="flex items-center gap-3 py-1">
      <button type="button" role="checkbox" aria-checked={i.checked} onClick={() => void toggle(i)}
        className={clsx('flex size-11 shrink-0 items-center justify-center rounded-full border-2 transition-colors', i.checked ? 'border-sage bg-sage text-white' : 'border-line bg-paper hover:border-brand')}
        aria-label={`${i.checked ? 'Fjern flueben fra' : 'Sæt flueben ved'} ${i.name}`}>
        {i.checked ? <Check className="size-5" /> : null}
      </button>
      {editId === i.id ? (
        <form method="post" className="flex flex-1 gap-2" onSubmit={(e) => {
          e.preventDefault();
          const v = String(new FormData(e.currentTarget).get('t') ?? '').trim();
          setEditId(null);
          if (!v) return;
          const p = parseShoppingInput(v);
          void write((cur) => cur.map((x) => (x.id === i.id ? { ...x, ...p } : x)), () => upsertShoppingItems(getBrowserClient(), list.id, [{ ...p, id: i.id, source_recipe_ids: i.source_recipe_ids }]));
        }}>
          <Input name="t" autoFocus defaultValue={`${amount(i)} ${i.name}`.trim()} aria-label="Redigér vare" />
          <Button type="submit" size="sm">Gem</Button>
        </form>
      ) : (
        <div className={clsx('min-w-0 flex-1', i.checked && 'text-ink-muted line-through')}>
          <span className="font-medium">{i.name}</span>
          {amount(i) ? <span className="ml-2 tabular-nums text-ink-soft">{amount(i)}</span> : null}
          {i.note ? <span className="ml-2 text-sm text-ink-muted">{i.note}</span> : null}
          {i.source_recipe_ids.length ? <span className="ml-2 text-xs text-ink-muted" title="Fra opskrifter">· {i.source_recipe_ids.length} opskr.</span> : null}
        </div>
      )}
      {canEdit && editId !== i.id ? (
        <div className="flex">
          <button type="button" onClick={() => setEditId(i.id)} className="rounded-full p-2.5 text-ink-muted hover:bg-sand" aria-label={`Redigér ${i.name}`}><Pencil className="size-4" /></button>
          <button type="button" onClick={() => void write((cur) => cur.filter((x) => x.id !== i.id), () => deleteShoppingItem(getBrowserClient(), i.id))} className="rounded-full p-2.5 text-ink-muted hover:bg-danger-soft hover:text-danger" aria-label={`Slet ${i.name}`}><Trash2 className="size-4" /></button>
        </div>
      ) : null}
    </li>
  );

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <Link href="/shopping" className="no-print text-sm text-ink-muted hover:text-ink">← Indkøb</Link>
          {editingName ? (
            <form method="post" className="mt-1 flex gap-2" onSubmit={(e) => { e.preventDefault(); const n = String(new FormData(e.currentTarget).get('n') ?? ''); setEditingName(false); if (n.trim()) start(async () => { await renameShoppingList(getBrowserClient(), list.id, n); router.refresh(); }); }}>
              <Input name="n" defaultValue={list.name} autoFocus aria-label="Listens navn" /><Button type="submit">Gem</Button>
            </form>
          ) : (
            <h1 className="text-3xl font-semibold sm:text-4xl">{list.name}{canEdit ? <button type="button" onClick={() => setEditingName(true)} className="ml-2 align-middle text-ink-muted hover:text-ink" aria-label="Omdøb liste"><Pencil className="inline size-5" /></button> : null}</h1>
          )}
          <p className="mt-1 flex items-center gap-2 text-sm text-ink-muted" aria-live="polite">
            {live === 'live' ? <><Wifi className="size-4 text-sage" aria-hidden /> Opdateres live</> : live === 'polling' ? <><WifiOff className="size-4" aria-hidden /> Opdateres hvert 15. sekund</> : 'Forbinder…'}
            <span>· {items.filter((i) => !i.checked).length} mangler</span>
          </p>
        </div>
      </header>

      {error ? <div className="mb-4"><Alert>{error}</Alert></div> : null}

      {canEdit ? (
        <form method="post" className="no-print mb-6 flex gap-2" onSubmit={(e) => { e.preventDefault(); add(); }}>
          <Input aria-label="Tilføj vare" value={text} onChange={(e) => setText(e.target.value)} placeholder="Tilføj vare, fx “2 l mælk”" className="text-base" />
          <Button type="submit" disabled={!text.trim()}><Plus className="size-5" aria-hidden /> Tilføj</Button>
        </form>
      ) : null}

      {groups.length === 0 && checked.length === 0 ? <p className="text-ink-muted">Listen er tom.</p> : null}
      {groups.length === 0 && checked.length > 0 ? <Alert tone="success">Alt er købt ind 🎉</Alert> : null}

      <div className="flex flex-col gap-6">
        {groups.map((g) => (
          <section key={g.category} aria-labelledby={`cat-${g.category}`}>
            <h2 id={`cat-${g.category}`} className="mb-1 text-sm font-semibold uppercase tracking-wide text-ink-muted">{SHOPPING_CATEGORY_LABELS[g.category] ?? g.category}</h2>
            <ul className="divide-y divide-line/60">{g.items.map(row)}</ul>
          </section>
        ))}
        {checked.length ? (
          <section aria-labelledby="cat-checked">
            <div className="mb-1 flex items-center justify-between">
              <h2 id="cat-checked" className="text-sm font-semibold uppercase tracking-wide text-ink-muted">I kurven ({checked.length})</h2>
              {canEdit ? <Button size="sm" variant="ghost" onClick={() => void write((cur) => cur.filter((i) => !i.checked), () => clearCheckedItems(getBrowserClient(), list.id))}>Ryd købte</Button> : null}
            </div>
            <ul className="divide-y divide-line/60">{checked.map(row)}</ul>
          </section>
        ) : null}
      </div>

      {canEdit ? (
        <div className="no-print mt-10 flex flex-wrap gap-2 border-t border-line pt-5">
          <Select aria-label="Handling" className="w-auto" defaultValue="" disabled={pending} onChange={(e) => {
            const v = e.target.value;
            e.target.value = '';
            if (v === 'archive') start(async () => { await archiveShoppingList(getBrowserClient(), list.id, true); router.replace('/shopping'); router.refresh(); });
            if (v === 'delete' && confirm(`Slet “${list.name}”?`)) start(async () => { await deleteShoppingList(getBrowserClient(), list.id); router.replace('/shopping'); router.refresh(); });
          }}>
            <option value="" disabled>Flere handlinger…</option>
            <option value="archive">Arkivér listen</option>
            <option value="delete">Slet listen</option>
          </Select>
        </div>
      ) : null}
    </div>
  );
}
