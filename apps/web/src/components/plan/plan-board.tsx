'use client';
import { deletePlanEntry, movePlanEntry, savePlanEntry, toDataError, type PlanEntry } from '@vores-kok/database';
import { addDays, formatDayLabel, MEAL_SLOT_LABELS, MEAL_SLOTS, weekDays, type MealSlot } from '@vores-kok/domain';
import clsx from 'clsx';
import { ChefHat, ChevronLeft, ChevronRight, Plus, ShoppingBasket, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition, type FormEvent } from 'react';
import { getBrowserClient } from '@/lib/supabase/client';
import { AddToListDialog } from '../add-to-list-dialog';
import { Dialog } from '../dialog';
import { Alert, Button, Field, Input, LinkButton, Select, Textarea } from '../ui';

export type RecipeOption = { id: string; title: string; servings: number | null };

export function EntryForm({ householdId, date, recipes, entry, onDone, presetRecipeId, presetServings }: { householdId: string; date: string; recipes: RecipeOption[]; entry?: PlanEntry; onDone: () => void; presetRecipeId?: string; presetServings?: number | null }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [recipeId, setRecipeId] = useState(entry?.recipe_id ?? presetRecipeId ?? '');
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const matches = useMemo(() => {
    const n = q.trim().toLowerCase();
    return (n ? recipes.filter((r) => r.title.toLowerCase().includes(n)) : recipes).slice(0, 8);
  }, [q, recipes]);
  const chosen = recipes.find((r) => r.id === recipeId);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    start(async () => {
      try {
        await savePlanEntry(getBrowserClient(), {
          id: entry?.id, household_id: householdId, plan_date: String(f.get('plan_date')), slot: String(f.get('slot')) as MealSlot,
          recipe_id: recipeId || null, title: recipeId ? null : String(f.get('title') ?? ''), servings: f.get('servings') as unknown as number,
          notes: String(f.get('notes') ?? ''),
        });
        onDone();
        router.refresh();
      } catch (err) { setError(toDataError(err).message); }
    });
  }

  return (
    <form method="post" onSubmit={submit} className="flex flex-col gap-4">
      {error ? <Alert>{error}</Alert> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Dato" htmlFor="pe-date"><Input id="pe-date" name="plan_date" type="date" defaultValue={entry?.plan_date ?? date} required /></Field>
        <Field label="Måltid" htmlFor="pe-slot">
          <Select id="pe-slot" name="slot" defaultValue={entry?.slot ?? 'dinner'}>
            {MEAL_SLOTS.map((s) => <option key={s} value={s}>{MEAL_SLOT_LABELS[s]}</option>)}
          </Select>
        </Field>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Opskrift</legend>
        {chosen ? (
          <div className="flex items-center justify-between rounded-xl bg-brand-soft px-3 py-2">
            <span className="font-medium text-brand-dark">{chosen.title}</span>
            <Button size="sm" variant="ghost" onClick={() => setRecipeId('')}>Skift</Button>
          </div>
        ) : (
          <>
            <Input aria-label="Søg efter opskrift" placeholder="Søg i familiens opskrifter…" value={q} onChange={(e) => setQ(e.target.value)} />
            <ul className="max-h-48 overflow-y-auto rounded-xl border border-line">
              {matches.map((r) => (
                <li key={r.id}><button type="button" onClick={() => setRecipeId(r.id)} className="w-full px-3 py-2 text-left hover:bg-sand">{r.title}</button></li>
              ))}
              {matches.length === 0 ? <li className="px-3 py-2 text-sm text-ink-muted">Ingen opskrifter matcher</li> : null}
            </ul>
            <Field label="…eller skriv en ret" htmlFor="pe-title"><Input id="pe-title" name="title" defaultValue={entry?.recipe_id ? '' : entry?.title ?? ''} placeholder="Fx Rester, Pizza fredag" /></Field>
          </>
        )}
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
        <Field label="Portioner" htmlFor="pe-serv"><Input id="pe-serv" name="servings" inputMode="numeric" defaultValue={entry?.servings ?? presetServings ?? chosen?.servings ?? ''} /></Field>
        <Field label="Note" htmlFor="pe-notes"><Textarea id="pe-notes" name="notes" rows={1} defaultValue={entry?.notes ?? ''} /></Field>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>Annullér</Button>
        <Button type="submit" disabled={pending}>Gem</Button>
      </div>
    </form>
  );
}

export function PlanBoard({ householdId, weekStart, weekLabel, entries, recipes, lists, canEdit, today }: {
  householdId: string; weekStart: string; weekLabel: string; entries: PlanEntry[]; recipes: RecipeOption[]; lists: Array<{ id: string; name: string }>; canEdit: boolean; today: string;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState<string | null>(null);
  const [editing, setEditing] = useState<PlanEntry | null>(null);
  const [shop, setShop] = useState(false);
  const [error, setError] = useState<string>();
  const [, start] = useTransition();
  const days = weekDays(weekStart);
  const byDay = useMemo(() => {
    const m = new Map<string, PlanEntry[]>();
    for (const e of entries) m.set(e.plan_date, [...(m.get(e.plan_date) ?? []), e]);
    return m;
  }, [entries]);
  const plannedRecipes = entries.filter((e) => e.recipe_id).length;

  const run = (fn: () => Promise<void>) => start(async () => { try { await fn(); router.refresh(); } catch (e) { setError(toDataError(e).message); } });

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold sm:text-4xl">Madplan</h1>
          <p className="mt-1 text-ink-soft">{weekLabel}</p>
        </div>
        <div className="no-print flex flex-wrap items-center gap-2">
          <LinkButton variant="secondary" href={`/plan?week=${addDays(weekStart, -7)}`} aria-label="Forrige uge"><ChevronLeft className="size-5" /></LinkButton>
          <LinkButton variant="ghost" href="/plan">I dag</LinkButton>
          <LinkButton variant="secondary" href={`/plan?week=${addDays(weekStart, 7)}`} aria-label="Næste uge"><ChevronRight className="size-5" /></LinkButton>
          {canEdit ? <Button onClick={() => setShop(true)} disabled={!plannedRecipes}><ShoppingBasket className="size-5" aria-hidden /> Lav indkøbsliste</Button> : null}
        </div>
      </header>
      {error ? <div className="mb-4"><Alert>{error}</Alert></div> : null}

      <ol className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-7">
        {days.map((d) => {
          const list = (byDay.get(d) ?? []).sort((a, b) => MEAL_SLOTS.indexOf(a.slot) - MEAL_SLOTS.indexOf(b.slot) || a.position - b.position);
          const isToday = d === today;
          return (
            <li key={d} aria-label={formatDayLabel(d)} className={clsx('flex min-h-40 flex-col rounded-[var(--radius-card)] border bg-paper p-3', isToday ? 'border-brand ring-2 ring-brand/20' : 'border-line')}>
              <div className="mb-2 flex items-baseline justify-between">
                <h2 className={clsx('font-display text-lg font-semibold', isToday && 'text-brand-dark')}>{formatDayLabel(d)}</h2>
                {isToday ? <span className="text-xs font-medium text-brand">I dag</span> : null}
              </div>
              <ul className="flex flex-1 flex-col gap-2">
                {list.map((e) => (
                  <li key={e.id} className="group rounded-xl bg-cream p-2.5">
                    <div className="text-xs font-medium uppercase tracking-wide text-ink-muted">{MEAL_SLOT_LABELS[e.slot]}{e.servings ? ` · ${e.servings} pers.` : ''}</div>
                    {e.recipe_id ? (
                      <Link href={`/recipes/${e.recipe_id}${e.servings ? `?servings=${e.servings}` : ''}`} className="font-medium text-ink hover:text-brand-dark hover:underline">{e.recipe_title ?? e.title}</Link>
                    ) : <div className="font-medium">{e.title}</div>}
                    {e.notes ? <p className="mt-0.5 text-sm text-ink-soft">{e.notes}</p> : null}
                    <div className="no-print mt-1 flex flex-wrap gap-1">
                      {e.recipe_id ? <Link href={`/cook/${e.recipe_id}${e.servings ? `?servings=${e.servings}` : ''}`} className="inline-flex min-h-8 items-center gap-1 rounded-full px-2 text-xs text-ink-soft hover:bg-sand"><ChefHat className="size-3.5" aria-hidden /> Kog</Link> : null}
                      {canEdit ? (
                        <>
                          <button type="button" onClick={() => setEditing(e)} className="min-h-8 rounded-full px-2 text-xs text-ink-soft hover:bg-sand">Redigér</button>
                          <button type="button" onClick={() => run(() => movePlanEntry(getBrowserClient(), e.id, addDays(e.plan_date, 1), e.slot))} className="min-h-8 rounded-full px-2 text-xs text-ink-soft hover:bg-sand" aria-label={`Flyt ${e.recipe_title ?? e.title} en dag frem`}>+1 dag</button>
                          <button type="button" onClick={() => run(() => deletePlanEntry(getBrowserClient(), e.id))} className="min-h-8 rounded-full px-2 text-xs text-danger hover:bg-danger-soft" aria-label={`Fjern ${e.recipe_title ?? e.title}`}><Trash2 className="size-3.5" /></button>
                        </>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
              {canEdit ? (
                <button type="button" onClick={() => setAdding(d)} className="no-print mt-2 inline-flex min-h-10 items-center justify-center gap-1 rounded-xl border border-dashed border-line text-sm text-ink-soft hover:border-brand hover:text-brand"
                  aria-label={`Tilføj ret ${formatDayLabel(d)}`}>
                  <Plus className="size-4" aria-hidden /> Tilføj
                </button>
              ) : null}
            </li>
          );
        })}
      </ol>

      <Dialog open={!!adding} onClose={() => setAdding(null)} title="Tilføj til madplanen">
        {adding ? <EntryForm householdId={householdId} date={adding} recipes={recipes} onDone={() => setAdding(null)} /> : null}
      </Dialog>
      <Dialog open={!!editing} onClose={() => setEditing(null)} title="Redigér">
        {editing ? <EntryForm householdId={householdId} date={editing.plan_date} recipes={recipes} entry={editing} onDone={() => setEditing(null)} /> : null}
      </Dialog>
      <AddToListDialog open={shop} onClose={() => setShop(false)} householdId={householdId} lists={lists}
        source={{ kind: 'plan', householdId, from: weekStart, to: addDays(weekStart, 6), label: weekLabel.split(' · ')[0] ?? weekLabel }} />
    </div>
  );
}
