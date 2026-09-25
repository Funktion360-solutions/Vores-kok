'use client';
import { deletePantryItem, deletePantryLocation, savePantryItem, savePantryLocation, toDataError, type PantryItem, type PantryLocation } from '@vores-kok/database';
import { expiryState, formatExpiry, formatQuantity, parseIngredientLine } from '@vores-kok/domain';
import clsx from 'clsx';
import { AlarmClock, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition, type FormEvent } from 'react';
import { getBrowserClient } from '@/lib/supabase/client';
import { Dialog } from '../dialog';
import { Alert, Badge, Button, Card, Field, Input, PageHeader, Select, Textarea } from '../ui';

const tone = { expired: 'bg-danger-soft text-danger', today: 'bg-danger-soft text-danger', soon: 'bg-honey-soft text-ink', ok: 'bg-sand text-ink-soft', none: '' } as const;

function ItemForm({ householdId, locations, item, defaultLocation, onDone }: { householdId: string; locations: PantryLocation[]; item?: PantryItem; defaultLocation?: string; onDone: () => void }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const parsed = parseIngredientLine(String(f.get('what') ?? ''));
    start(async () => {
      try {
        await savePantryItem(getBrowserClient(), {
          id: item?.id, household_id: householdId, location_id: String(f.get('location_id')), name: parsed.name,
          quantity: parsed.quantity, unit: parsed.unit, unit_code: parsed.unitCode,
          best_before: String(f.get('best_before') ?? ''), opened_on: String(f.get('opened_on') ?? ''), notes: String(f.get('notes') ?? ''),
        });
        onDone();
        router.refresh();
      } catch (err) { setError(toDataError(err).message); }
    });
  }
  const current = item ? [item.quantity != null ? formatQuantity(Number(item.quantity)) : '', item.unit ?? '', item.name].filter(Boolean).join(' ') : '';
  return (
    <form method="post" onSubmit={submit} className="flex flex-col gap-3">
      {error ? <Alert>{error}</Alert> : null}
      <Field label="Hvad og hvor meget" htmlFor="pi-what" hint="Fx “1 l mælk”, “500 g hakket oksekød” eller bare “kanel”"><Input id="pi-what" name="what" defaultValue={current} required autoFocus /></Field>
      <Field label="Hvor" htmlFor="pi-loc">
        <Select id="pi-loc" name="location_id" defaultValue={item?.location_id ?? defaultLocation ?? locations[0]?.id}>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </Select>
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Bedst før" htmlFor="pi-bb"><Input id="pi-bb" name="best_before" type="date" defaultValue={item?.best_before ?? ''} /></Field>
        <Field label="Åbnet" htmlFor="pi-open"><Input id="pi-open" name="opened_on" type="date" defaultValue={item?.opened_on ?? ''} /></Field>
      </div>
      <Field label="Note" htmlFor="pi-notes"><Textarea id="pi-notes" name="notes" rows={2} defaultValue={item?.notes ?? ''} /></Field>
      <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onDone}>Annullér</Button><Button type="submit" disabled={pending}>Gem</Button></div>
    </form>
  );
}

export function PantryView({ householdId, locations, items, canEdit, today }: { householdId: string; locations: PantryLocation[]; items: PantryItem[]; canEdit: boolean; today: string }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [dialog, setDialog] = useState<{ item?: PantryItem; location?: string } | null>(null);
  const [newLoc, setNewLoc] = useState('');
  const [error, setError] = useState<string>();
  const [, start] = useTransition();
  const filtered = useMemo(() => items.filter((i) => !q.trim() || i.name.toLowerCase().includes(q.trim().toLowerCase())), [items, q]);
  const urgent = useMemo(() => items.filter((i) => ['expired', 'today', 'soon'].includes(expiryState(i.best_before, today))).sort((a, b) => (a.best_before ?? '').localeCompare(b.best_before ?? '')), [items, today]);
  const run = (fn: () => Promise<void>) => start(async () => { try { await fn(); router.refresh(); } catch (e) { setError(toDataError(e).message); } });

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Mit køkken" subtitle="Hvad har vi i køleskab, fryser og skabe?"
        actions={canEdit ? <Button onClick={() => setDialog({})}><Plus className="size-5" aria-hidden /> Tilføj vare</Button> : null} />
      {error ? <div className="mb-4"><Alert>{error}</Alert></div> : null}

      {urgent.length ? (
        <Card className="mb-6 border-honey/50 bg-honey-soft/50 p-5">
          <h2 className="flex items-center gap-2 text-xl font-semibold"><AlarmClock className="size-5 text-honey" aria-hidden /> Skal bruges snart</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {urgent.map((i) => (
              <li key={i.id}>
                <Link href={`/recipes?ingredients=${encodeURIComponent(i.name)}`} className={clsx('inline-flex min-h-9 items-center gap-2 rounded-full px-3 text-sm', tone[expiryState(i.best_before, today)])}>
                  <span className="font-medium">{i.name}</span> · {formatExpiry(i.best_before, today)}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-ink-soft">Tryk på en vare for at se opskrifter, der bruger den.</p>
        </Card>
      ) : null}

      <div className="relative mb-6 max-w-md">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-ink-muted" aria-hidden />
        <Input type="search" aria-label="Søg i køkkenet" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Søg i køkkenet" className="pl-11" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {locations.map((loc) => {
          const list = filtered.filter((i) => i.location_id === loc.id);
          return (
            <Card key={loc.id} className="p-5">
              <section aria-labelledby={`loc-${loc.id}`}>
                <div className="mb-2 flex items-center justify-between">
                  <h2 id={`loc-${loc.id}`} className="text-xl font-semibold">{loc.name} <span className="text-base font-normal text-ink-muted">({list.length})</span></h2>
                  {canEdit ? <button type="button" onClick={() => setDialog({ location: loc.id })} className="rounded-full p-2 hover:bg-sand" aria-label={`Tilføj til ${loc.name}`}><Plus className="size-5" /></button> : null}
                </div>
                {list.length === 0 ? <p className="text-sm text-ink-muted">Tomt.</p> : null}
                <ul className="divide-y divide-line/60">
                  {list.map((i) => {
                    const st = expiryState(i.best_before, today);
                    return (
                      <li key={i.id} className="flex items-center gap-2 py-2">
                        <div className="min-w-0 flex-1">
                          <div><span className="font-medium">{i.name}</span>{i.quantity != null ? <span className="ml-2 text-ink-soft">{formatQuantity(Number(i.quantity))} {i.unit ?? ''}</span> : null}</div>
                          <div className="flex flex-wrap gap-1.5 text-xs">
                            {i.best_before ? <span className={clsx('rounded-full px-2 py-0.5', tone[st])}>{formatExpiry(i.best_before, today)}</span> : null}
                            {i.opened_on ? <Badge>Åbnet</Badge> : null}
                            {i.notes ? <span className="text-ink-muted">{i.notes}</span> : null}
                          </div>
                        </div>
                        {canEdit ? (
                          <>
                            <button type="button" onClick={() => setDialog({ item: i })} className="rounded-full p-2 text-ink-muted hover:bg-sand" aria-label={`Redigér ${i.name}`}><Pencil className="size-4" /></button>
                            <button type="button" onClick={() => run(() => deletePantryItem(getBrowserClient(), i.id))} className="rounded-full p-2 text-ink-muted hover:bg-danger-soft hover:text-danger" aria-label={`Brugt op: ${i.name}`}><Trash2 className="size-4" /></button>
                          </>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
                {canEdit && list.length === 0 && loc.position >= 99 ? (
                  <button type="button" className="mt-2 text-sm text-danger hover:underline" onClick={() => run(() => deletePantryLocation(getBrowserClient(), loc.id))}>Fjern stedet</button>
                ) : null}
              </section>
            </Card>
          );
        })}
      </div>

      {canEdit ? (
        <form method="post" className="mt-6 flex max-w-md gap-2" onSubmit={(e) => { e.preventDefault(); if (newLoc.trim()) run(async () => { await savePantryLocation(getBrowserClient(), { household_id: householdId, name: newLoc }); setNewLoc(''); }); }}>
          <Input aria-label="Nyt opbevaringssted" value={newLoc} onChange={(e) => setNewLoc(e.target.value)} placeholder="Nyt sted, fx “Kælderen”" />
          <Button type="submit" variant="secondary" disabled={!newLoc.trim()}>Tilføj sted</Button>
        </form>
      ) : null}

      <Dialog open={!!dialog} onClose={() => setDialog(null)} title={dialog?.item ? 'Redigér vare' : 'Tilføj vare'}>
        {dialog ? <ItemForm householdId={householdId} locations={locations} item={dialog.item} defaultLocation={dialog.location} onDone={() => setDialog(null)} /> : null}
      </Dialog>
    </div>
  );
}
