'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatDayLabel } from '@vores-kok/domain';
import type { PlanEntry } from '@vores-kok/database';
import { validateMealPlanResult } from '../../../../../packages/validation/src/meal-plan-ai';
import { getBrowserClient } from '@/lib/supabase/client';
import { Alert, Button, Card, Field, Input, Select, Spinner, Textarea } from '../ui';
import type { RecipeOption } from './plan-board';
type Draft = { id: string; date: string; recipe_id: string; reason: string; included: boolean };
export function AiPlanDraft({ householdId, days, entries, recipes, onDone }: { householdId: string; days: string[]; entries: PlanEntry[]; recipes: RecipeOption[]; onDone: () => void }) {
  const router = useRouter();
  const available = days.filter(d => !entries.some(e => e.plan_date === d && e.slot === 'dinner'));
  const [servings, setServings] = useState('2'); const [wishes, setWishes] = useState('');
  const [drafts, setDrafts] = useState<Draft[]>([]); const [warnings, setWarnings] = useState<string[]>([]);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function generate() {
    setBusy(true); setError('');
    try {
      const count = Number(servings); if (!Number.isInteger(count) || count < 1 || count > 1000) throw new Error('Angiv 1–1000 portioner.');
      const { data, error: fnError } = await getBrowserClient().functions.invoke('ai-meal-plan', { body: { householdId, dates: available, servings: count, wishes }, signal: AbortSignal.timeout(75000) });
      if (fnError) { const response = 'context' in fnError ? fnError.context : null; if (response instanceof Response) { const body = await response.json().catch(() => null); throw new Error(body?.error ?? 'Forslaget kunne ikke laves.'); } throw new Error('AI svarede ikke. Prøv igen; kontrollér at ai-meal-plan er deployet.'); }
      const result = validateMealPlanResult(data, available, recipes.map(r => r.id));
      setDrafts(result.suggestions.sort((a, b) => a.date.localeCompare(b.date)).map(d => ({ ...d, id: crypto.randomUUID(), included: true })));
      setWarnings(result.warnings);
    } catch (e) { setError(e instanceof Error ? e.message : 'Forslaget kunne ikke laves.'); }
    finally { setBusy(false); }
  }
  async function save() {
    setBusy(true); setError('');
    try {
      const count = Number(servings);
      if (!Number.isInteger(count) || count < 1 || count > 1000) throw new Error('Angiv 1–1000 portioner.');
      const db = getBrowserClient();
      const selected = drafts.filter(d => d.included);
      if (!selected.length) throw new Error('Vælg mindst ét forslag.');
      // Keep stable IDs across retries: a lost response must not duplicate the plan.
      const { data: previous, error: previousError } = await db.from('meal_plan_entries').select('id,plan_date').eq('household_id', householdId).in('id', selected.map(d => d.id));
      if (previousError) throw previousError;
      const saved = new Set(previous.map(e => e.id));
      const pending = selected.filter(d => !saved.has(d.id));
      if (pending.length) {
        const { data: current, error: currentError } = await db.from('meal_plan_entries').select('plan_date').eq('household_id', householdId).eq('slot', 'dinner').in('plan_date', pending.map(d => d.date));
        if (currentError) throw currentError;
        if (current.length) throw new Error('En af dagene har fået aftensmad siden forslaget blev lavet. Genindlæs madplanen, før du fortsætter.');
        const { error: saveError } = await db.from('meal_plan_entries').insert(pending.map(d => ({ id: d.id, household_id: householdId, plan_date: d.date, slot: 'dinner' as const, recipe_id: d.recipe_id, servings: Number(servings), notes: recipes.find(r => r.id === d.recipe_id) ? 'Valgt fra AI-madplansforslag.' : null })));
        if (saveError) throw saveError;
      }
      router.refresh(); onDone();
    } catch (e) { setError(e instanceof Error ? e.message : 'Madplanen kunne ikke gemmes. Du kan prøve igen uden at oprette dubletter.'); }
    finally { setBusy(false); }
  }
  return <div className="space-y-5"><p className="text-sm leading-relaxed text-ink-soft">AI foreslår aftensmad på ugens {available.length} ledige dage fra familiens kogebog. Eksisterende måltider bevares. Opskrifternes titler, ingrediensnavne og korte beskrivelser samt dine ønsker sendes til AI. Forslag gemmes først, når du godkender.</p>
    {!available.length ? <Alert tone="info">Alle ugens dage har allerede aftensmad.</Alert> : !recipes.length ? <Alert tone="info">Gem nogle opskrifter i kogebogen først.</Alert> : <><div className="grid gap-4 sm:grid-cols-[8rem_1fr]"><Field label="Portioner" htmlFor="ai-plan-servings"><Input id="ai-plan-servings" type="number" min={1} max={1000} value={servings} disabled={busy} onChange={e => setServings(e.target.value)} /></Field><Field label="Ønsker til ugen" htmlFor="ai-plan-wishes" hint="Fx hurtige retter, variation eller ingredienser du vil bruge."><Textarea id="ai-plan-wishes" rows={3} maxLength={2000} value={wishes} disabled={busy} onChange={e => setWishes(e.target.value)} placeholder="Fx højst 30 minutter på hverdage og pasta én dag" /></Field></div><Button variant="secondary" disabled={busy || !!drafts.length} onClick={() => void generate()}>{busy ? <><Spinner /> Arbejder…</> : 'Foreslå aftensmad'}</Button></>}
    {error ? <Alert>{error}</Alert> : null}{warnings.length ? <Alert tone="info"><ul className="list-disc space-y-1 pl-5">{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul></Alert> : null}
    {drafts.length ? <><div className="space-y-3">{drafts.map((d, i) => <Card key={d.id} className="p-4"><label className="mb-3 flex min-h-10 items-center gap-3 font-medium"><input type="checkbox" checked={d.included} disabled={busy} onChange={e => setDrafts(ds => ds.map((row, j) => i === j ? { ...row, included: e.target.checked } : row))} />{formatDayLabel(d.date)}</label><Field label="Ret" htmlFor={`ai-plan-recipe-${i}`}><Select id={`ai-plan-recipe-${i}`} disabled={busy} value={d.recipe_id} onChange={e => setDrafts(ds => ds.map((row, j) => i === j ? { ...row, recipe_id: e.target.value, reason: 'Du har valgt en anden opskrift.' } : row))}>{recipes.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}</Select></Field><p className="mt-2 text-sm text-ink-soft">{d.reason}</p></Card>)}</div><p className="text-xs text-ink-muted">AI kan overse kostønsker. Kontrollér opskrifterne. Forslaget omfatter højst 200 opskrifter; det kontrollerer ikke dit køkkenlager. Efter gemning kan du bruge “Lav indkøbsliste” på madplanen.</p><Button disabled={busy || !drafts.some(d => d.included)} onClick={() => void save()}>{busy ? <><Spinner /> Arbejder…</> : 'Godkend og tilføj til madplan'}</Button></> : null}
  </div>;
}
