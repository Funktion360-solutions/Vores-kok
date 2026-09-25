'use client';
import {
  addLinesToList, createShoppingList, getRecipe, listPantryItems, pantryStock, planShoppingLines, previewLines, recipeShoppingLines, toDataError,
} from '@vores-kok/database';
import { formatShoppingAmount, SHOPPING_CATEGORY_LABELS, type AggregatedLine, type ShoppingLine } from '@vores-kok/domain';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { getBrowserClient } from '@/lib/supabase/client';
import { Dialog } from './dialog';
import { Alert, Button, Field, Input, Select, Spinner } from './ui';

export type ShoppingSource =
  | { kind: 'recipe'; recipeId: string; servings: number | null; title: string }
  | { kind: 'plan'; householdId: string; from: string; to: string; label: string };

/**
 * "Tilføj til indkøbsliste": computes lines (scaled + aggregated, optionally
 * minus what is in Mit køkken), shows a preview, then merges into a list.
 */
export function AddToListDialog({ open, onClose, source, householdId, lists }: {
  open: boolean; onClose: () => void; source: ShoppingSource; householdId: string; lists: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [raw, setRaw] = useState<ShoppingLine[] | null>(null);
  const [preview, setPreview] = useState<{ lines: AggregatedLine[]; input: ShoppingLine[]; covered: string[] } | null>(null);
  const [skipPantry, setSkipPantry] = useState(true);
  const [listId, setListId] = useState(lists[0]?.id ?? 'new');
  const [newName, setNewName] = useState(source.kind === 'plan' ? `Indkøb ${source.label}` : 'Indkøbsliste');
  const [error, setError] = useState<string>();
  const [done, setDone] = useState<string>();
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!open) return;
    const db = getBrowserClient();
    (async () => {
      try {
        const lines = source.kind === 'recipe'
          ? await getRecipe(db, source.recipeId).then((d) => (d ? recipeShoppingLines(d, source.servings) : []))
          : (await planShoppingLines(db, source.householdId, source.from, source.to)).lines;
        setRaw(lines);
      } catch (e) { setError(toDataError(e).message); }
    })();
    // The source is re-created by parents on every render; compare by value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, JSON.stringify(source)]);

  useEffect(() => {
    if (!raw) return;
    (async () => {
      const pantry = skipPantry ? pantryStock(await listPantryItems(getBrowserClient(), householdId)) : [];
      setPreview(previewLines(raw, pantry, skipPantry));
    })().catch((e) => setError(toDataError(e).message));
  }, [raw, skipPantry, householdId]);

  function add() {
    if (!preview) return;
    start(async () => {
      try {
        const db = getBrowserClient();
        const target = listId === 'new' ? (await createShoppingList(db, householdId, newName || 'Indkøbsliste')).id : listId;
        const n = await addLinesToList(db, target, preview.input);
        setDone(target);
        router.refresh();
        setError(undefined);
        if (n === 0) setError('Der var ikke noget at tilføje.');
      } catch (e) { setError(toDataError(e).message); }
    });
  }

  const close = () => { setRaw(null); setPreview(null); setError(undefined); setDone(undefined); onClose(); };

  return (
    <Dialog open={open} onClose={close} title="Tilføj til indkøbsliste" wide>
      <div className="flex flex-col gap-4">
        <p className="text-ink-soft">{source.kind === 'recipe' ? `${source.title}${source.servings ? ` · ${source.servings} portioner` : ''}` : `Alle opskrifter i madplanen · ${source.label}`}</p>
        {error ? <Alert>{error}</Alert> : null}
        {done ? (
          <Alert tone="success">
            Tilføjet! <a href={`/shopping/${done}`} className="font-medium underline">Åbn listen</a>
          </Alert>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Liste" htmlFor="atl-list">
            <Select id="atl-list" value={listId} onChange={(e) => setListId(e.target.value)}>
              {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              <option value="new">+ Ny liste</option>
            </Select>
          </Field>
          {listId === 'new' ? <Field label="Navn på ny liste" htmlFor="atl-name"><Input id="atl-name" value={newName} onChange={(e) => setNewName(e.target.value)} /></Field> : null}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={skipPantry} onChange={(e) => setSkipPantry(e.target.checked)} className="size-5 accent-[var(--vk-terracotta)]" />
          Spring over det, vi allerede har i Mit køkken
        </label>
        {!preview ? <div className="flex items-center gap-2 text-ink-muted"><Spinner /> Beregner…</div> : (
          <div>
            <h3 className="mb-2 text-sm font-medium text-ink-soft">{preview.lines.length} varer</h3>
            <ul className="max-h-72 divide-y divide-line overflow-y-auto rounded-xl border border-line">
              {preview.lines.map((l) => (
                <li key={l.key} className="flex items-baseline justify-between gap-3 px-3 py-2 text-sm">
                  <span><span className="font-medium">{l.name}</span> <span className="text-ink-muted">· {SHOPPING_CATEGORY_LABELS[l.category]}</span></span>
                  <span className="shrink-0 tabular-nums">{formatShoppingAmount(l)}</span>
                </li>
              ))}
            </ul>
            {preview.covered.length ? <p className="mt-2 text-sm text-sage">Har allerede: {preview.covered.join(', ')}</p> : null}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={close}>Luk</Button>
          <Button onClick={add} disabled={pending || !preview || !preview.lines.length || !!done}>{pending ? <Spinner /> : null} Tilføj {preview?.lines.length ?? ''} varer</Button>
        </div>
      </div>
    </Dialog>
  );
}
