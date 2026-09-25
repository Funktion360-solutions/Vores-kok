'use client';
import { saveCategory, savePerson, saveRecipe, toDataError, type Category, type Person } from '@vores-kok/database';
import {
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  formatQuantityRange,
  MEAL_TYPES,
  MEAL_TYPE_LABELS,
  parseIngredientLine,
  parseQuantity,
  resolveUnit,
  UNITS,
  type MealType,
} from '@vores-kok/domain';
import { fieldErrors, type RecipeInput, type RecipePayload } from '@vores-kok/validation';
import clsx from 'clsx';
import { ArrowDown, ArrowUp, ClipboardPaste, GripVertical, Heading, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useId, useState, useTransition, type ReactNode } from 'react';
import { getBrowserClient } from '@/lib/supabase/client';
import { Alert, Button, Card, Field, Input, Select, Spinner, Textarea } from '../ui';

type IngRow =
  | { key: string; kind: 'section'; title: string }
  | { key: string; kind: 'item'; id?: string | null; qty: string; unit: string; name: string; preparation: string; original_text?: string | null; is_optional: boolean; is_scalable: boolean };
type StepRow = { key: string; id?: string | null; body: string; minutes: string };

let seq = 0;
const k = () => `r${++seq}`;

function toRows(input: RecipePayload): IngRow[] {
  const rows: IngRow[] = [];
  let section: string | null | undefined = null;
  for (const i of input.ingredients ?? []) {
    if ((i.section ?? null) !== section) {
      section = i.section ?? null;
      if (section) rows.push({ key: k(), kind: 'section', title: section });
    }
    const q = typeof i.quantity === 'number' ? i.quantity : null;
    const qm = typeof i.quantity_max === 'number' ? i.quantity_max : null;
    rows.push({
      key: k(), kind: 'item', id: i.id ?? null, qty: q != null ? formatQuantityRange(q, qm) : '', unit: i.unit ?? '', name: i.name,
      preparation: i.preparation ?? '', original_text: i.original_text ?? null, is_optional: i.is_optional ?? false, is_scalable: i.is_scalable ?? true,
    });
  }
  return rows.length ? rows : [{ key: k(), kind: 'item', qty: '', unit: '', name: '', preparation: '', is_optional: false, is_scalable: true }];
}

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [x] = next.splice(from, 1);
  next.splice(to, 0, x!);
  return next;
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-xl font-semibold">{title}</h2>
      {description ? <p className="mt-1 text-sm text-ink-soft">{description}</p> : null}
      <div className="mt-5 flex flex-col gap-4">{children}</div>
    </Card>
  );
}

export function RecipeEditor({ initial, categories: initialCategories, people: initialPeople, mode }: {
  initial: RecipePayload; categories: Category[]; people: Person[]; mode: 'create' | 'edit';
}) {
  const router = useRouter();
  const uid = useId();
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [conflict, setConflict] = useState(false);
  const [categories, setCategories] = useState(initialCategories);
  const [people, setPeople] = useState(initialPeople);

  const [basics, setBasics] = useState({
    title: initial.title ?? '', description: initial.description ?? '', category_id: initial.category_id ?? '',
    servings: initial.servings != null ? String(initial.servings) : '', yield_unit: initial.yield_unit ?? '',
    prep_minutes: initial.prep_minutes != null ? String(initial.prep_minutes) : '', cook_minutes: initial.cook_minutes != null ? String(initial.cook_minutes) : '',
    total_minutes: initial.total_minutes != null ? String(initial.total_minutes) : '', difficulty: initial.difficulty ?? '',
    notes: initial.notes ?? '', cuisine: initial.cuisine ?? '',
    source_name: initial.source_name ?? '', source_url: initial.source_url ?? '',
    origin_person_id: initial.origin_person_id ?? '', origin_text: initial.origin_text ?? '',
    origin_year: initial.origin_year != null ? String(initial.origin_year) : '', origin_year_approx: initial.origin_year_approx ?? true,
    tags: (initial.tags ?? []).join(', '),
  });
  const [meals, setMeals] = useState<MealType[]>((initial.meal_types ?? []) as MealType[]);
  const [ings, setIngs] = useState<IngRow[]>(() => toRows(initial));
  const [steps, setSteps] = useState<StepRow[]>(() => {
    const s = (initial.steps ?? []).map((x) => ({ key: k(), id: x.id ?? null, body: x.body, minutes: typeof x.timer_seconds === 'number' ? String(Math.round(x.timer_seconds / 60)) : '' }));
    return s.length ? s : [{ key: k(), body: '', minutes: '' }];
  });
  const [paste, setPaste] = useState<null | 'ingredients' | 'steps'>(null);
  const [pasteText, setPasteText] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newPerson, setNewPerson] = useState({ name: '', relation: '' });

  const set = (patch: Partial<typeof basics>) => setBasics((b) => ({ ...b, ...patch }));
  const updIng = (key: string, patch: Partial<Extract<IngRow, { kind: 'item' }>> | { title: string }) =>
    setIngs((rows) => rows.map((r) => (r.key === key ? ({ ...r, ...patch } as IngRow) : r)));

  function applyPaste() {
    const lines = pasteText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (paste === 'ingredients') {
      const rows: IngRow[] = lines.map((line) => {
        if (/:$/.test(line) && !/\d/.test(line)) return { key: k(), kind: 'section', title: line.replace(/:$/, '') };
        const p = parseIngredientLine(line);
        return { key: k(), kind: 'item', qty: p.quantity != null ? formatQuantityRange(p.quantity, p.quantityMax) : '', unit: p.unit ?? '', name: p.name, preparation: p.preparation ?? '', original_text: p.originalText, is_optional: p.isOptional, is_scalable: true };
      });
      setIngs((cur) => [...cur.filter((r) => r.kind === 'section' || r.name.trim()), ...rows]);
    } else if (paste === 'steps') {
      const parts = pasteText.split(/\n\s*\n|\n(?=\s*\d+[.)]\s)/).map((p) => p.replace(/^\s*\d+[.)]\s*/, '').trim()).filter(Boolean);
      setSteps((cur) => [...cur.filter((s) => s.body.trim()), ...parts.map((body) => ({ key: k(), body, minutes: '' }))]);
    }
    setPaste(null);
    setPasteText('');
  }

  function buildInput(): RecipeInput {
    let section: string | null = null;
    const ingredients: NonNullable<RecipeInput['ingredients']> = [];
    for (const r of ings) {
      if (r.kind === 'section') { section = r.title.trim() || null; continue; }
      if (!r.name.trim() && !r.qty.trim()) continue;
      const q = r.qty.trim() ? parseQuantity(r.qty) : null;
      const unit = resolveUnit(r.unit);
      const line = [r.qty, r.unit, r.name].filter((s) => s.trim()).join(' ') + (r.preparation ? `, ${r.preparation}` : '');
      ingredients.push({
        id: r.id ?? undefined, section, quantity: q?.quantity ?? null, quantity_max: q?.quantityMax ?? null,
        unit: r.unit.trim() || null, unit_code: unit?.code ?? null, name: r.name.trim() || (q ? '' : r.qty.trim()),
        preparation: r.preparation || null,
        // Keep the text exactly as typed when the amount is not machine-readable (e.g. "en god klat").
        original_text: r.original_text ?? (r.qty.trim() && !q ? line : null),
        is_optional: r.is_optional, is_scalable: r.is_scalable,
      });
      if (r.qty.trim() && !q) {
        const last = ingredients[ingredients.length - 1]!;
        last.name = `${r.qty.trim()} ${r.unit.trim()} ${r.name.trim()}`.replace(/\s+/g, ' ').trim();
        last.unit = null;
        last.unit_code = null;
      }
    }
    return {
      id: initial.id, household_id: initial.household_id, expected_version: initial.expected_version ?? null,
      title: basics.title, description: basics.description, category_id: basics.category_id, cuisine: basics.cuisine,
      meal_types: meals, servings: basics.servings as unknown as number, yield_unit: basics.yield_unit,
      prep_minutes: basics.prep_minutes as unknown as number, cook_minutes: basics.cook_minutes as unknown as number,
      total_minutes: basics.total_minutes as unknown as number, difficulty: (basics.difficulty || null) as RecipeInput['difficulty'],
      notes: basics.notes, source_type: initial.source_type ?? 'manual', source_name: basics.source_name, source_url: basics.source_url,
      origin_person_id: basics.origin_person_id, origin_text: basics.origin_text, origin_year: basics.origin_year as unknown as number,
      origin_year_approx: basics.origin_year_approx,
      ingredients,
      steps: steps.filter((s) => s.body.trim()).map((s) => ({ id: s.id ?? undefined, body: s.body, timer_seconds: s.minutes ? Math.round(Number(s.minutes) * 60) : null })),
      tags: basics.tags.split(',').map((t) => t.trim()).filter(Boolean),
    };
  }

  function onSave() {
    setErrors({});
    setConflict(false);
    const input = buildInput();
    start(async () => {
      try {
        const res = await saveRecipe(getBrowserClient(), input);
        router.push(`/recipes/${res.id}`);
        router.refresh();
      } catch (err) {
        const e = toDataError(err);
        if (e.isConflict) setConflict(true);
        const cause = e.cause as { issues?: Array<{ path: PropertyKey[]; message: string }> } | undefined;
        setErrors(cause?.issues ? { ...fieldErrors({ issues: cause.issues }), _: e.message } : { _: e.message });
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }

  function addCategory() {
    const name = newCategory.trim();
    if (!name) return;
    start(async () => {
      try {
        const c = await saveCategory(getBrowserClient(), { household_id: initial.household_id, name });
        setCategories((cs) => [...cs, c].sort((a, b) => a.name.localeCompare(b.name, 'da')));
        set({ category_id: c.id });
        setNewCategory('');
      } catch (err) { setErrors({ category_id: toDataError(err).message }); }
    });
  }

  function addPerson() {
    if (!newPerson.name.trim()) return;
    start(async () => {
      try {
        const p = await savePerson(getBrowserClient(), { household_id: initial.household_id, name: newPerson.name.trim(), relation: newPerson.relation.trim() || null });
        setPeople((ps) => [...ps, p].sort((a, b) => a.name.localeCompare(b.name, 'da')));
        set({ origin_person_id: p.id });
        setNewPerson({ name: '', relation: '' });
      } catch (err) { setErrors({ origin_person_id: toDataError(err).message }); }
    });
  }

  const id = (s: string) => `${uid}-${s}`;
  return (
    <div className="flex flex-col gap-6">
      {errors._ ? (
        <Alert>
          {errors._}
          {conflict ? <> <button type="button" className="ml-1 underline" onClick={() => window.location.reload()}>Hent nyeste version</button> (dine ændringer går tabt).</> : null}
        </Alert>
      ) : null}

      <Section title="Grundlæggende">
        <Field label="Titel" htmlFor={id('title')} error={errors.title}>
          <Input id={id('title')} value={basics.title} onChange={(e) => set({ title: e.target.value })} maxLength={200} placeholder="Fx Oldemors æblekage" className="text-lg" aria-invalid={!!errors.title} />
        </Field>
        <Field label="Kort beskrivelse" htmlFor={id('desc')}>
          <Textarea id={id('desc')} rows={3} value={basics.description} onChange={(e) => set({ description: e.target.value })} maxLength={4000} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Kategori" htmlFor={id('cat')} error={errors.category_id}>
            <Select id={id('cat')} value={basics.category_id} onChange={(e) => set({ category_id: e.target.value })}>
              <option value="">Ingen kategori</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <div className="flex gap-2">
              <Input aria-label="Ny kategori" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="…eller opret ny" />
              <Button variant="secondary" onClick={addCategory} disabled={!newCategory.trim() || pending}>Opret</Button>
            </div>
          </Field>
          <Field label="Sværhedsgrad" htmlFor={id('diff')}>
            <Select id={id('diff')} value={basics.difficulty} onChange={(e) => set({ difficulty: e.target.value })}>
              <option value="">Ikke angivet</option>
              {DIFFICULTIES.map((d) => <option key={d} value={d}>{DIFFICULTY_LABELS[d]}</option>)}
            </Select>
          </Field>
        </div>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Måltid</legend>
          <div className="flex flex-wrap gap-2">
            {MEAL_TYPES.map((m) => (
              <button key={m} type="button" aria-pressed={meals.includes(m)} onClick={() => setMeals((ms) => (ms.includes(m) ? ms.filter((x) => x !== m) : [...ms, m]))}
                className={clsx('min-h-9 rounded-full border px-3 text-sm', meals.includes(m) ? 'border-brand bg-brand-soft text-brand-dark' : 'border-line hover:bg-sand')}>
                {MEAL_TYPE_LABELS[m]}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <Field label="Portioner / antal" htmlFor={id('serv')} error={errors.servings}><Input id={id('serv')} inputMode="numeric" value={basics.servings} onChange={(e) => set({ servings: e.target.value.replace(/\D/g, '') })} /></Field>
          <Field label="Enhed" htmlFor={id('yu')} hint="Tom = personer"><Input id={id('yu')} value={basics.yield_unit} onChange={(e) => set({ yield_unit: e.target.value })} placeholder="stk, kranse…" /></Field>
          <Field label="Forberedelse (min)" htmlFor={id('prep')} error={errors.prep_minutes}><Input id={id('prep')} inputMode="numeric" value={basics.prep_minutes} onChange={(e) => set({ prep_minutes: e.target.value.replace(/\D/g, '') })} /></Field>
          <Field label="Tilberedning (min)" htmlFor={id('cook')} error={errors.cook_minutes}><Input id={id('cook')} inputMode="numeric" value={basics.cook_minutes} onChange={(e) => set({ cook_minutes: e.target.value.replace(/\D/g, '') })} /></Field>
          <Field label="I alt (min)" htmlFor={id('tot')} hint="Inkl. hævning/hvile"><Input id={id('tot')} inputMode="numeric" value={basics.total_minutes} onChange={(e) => set({ total_minutes: e.target.value.replace(/\D/g, '') })} /></Field>
        </div>
        <Field label="Tags" htmlFor={id('tags')} hint="Adskil med komma, fx jul, hverdag, glutenfri"><Input id={id('tags')} value={basics.tags} onChange={(e) => set({ tags: e.target.value })} /></Field>
      </Section>

      <Section title="Ingredienser" description="Skriv mængde, enhed og ingrediens. Utraditionelle mængder som “en god klat” er helt fine — de gemmes som skrevet.">
        <datalist id={id('units')}>{UNITS.map((u) => <option key={u.code} value={u.label} />)}</datalist>
        <ul className="flex flex-col gap-2">
          {ings.map((r, idx) => (
            <li key={r.key} className="flex items-start gap-1.5">
              <span className="mt-3 hidden text-ink-muted sm:block" aria-hidden><GripVertical className="size-4" /></span>
              {r.kind === 'section' ? (
                <Input aria-label="Sektionsnavn" value={r.title} onChange={(e) => updIng(r.key, { title: e.target.value })} placeholder="Sektion, fx Fyld" className="flex-1 font-display font-semibold" />
              ) : (
                <div className="grid flex-1 grid-cols-[5.5rem_5rem_1fr] gap-1.5 sm:grid-cols-[6rem_6rem_1fr_10rem]">
                  <Input aria-label="Mængde" value={r.qty} onChange={(e) => updIng(r.key, { qty: e.target.value, original_text: null })} placeholder="2½" aria-invalid={!!r.qty.trim() && !parseQuantity(r.qty) ? true : undefined} />
                  <Input aria-label="Enhed" list={id('units')} value={r.unit} onChange={(e) => updIng(r.key, { unit: e.target.value, original_text: null })} placeholder="dl" />
                  <Input aria-label="Ingrediens" value={r.name} onChange={(e) => updIng(r.key, { name: e.target.value })} placeholder="hvedemel" aria-invalid={!!errors[`ingredients.${idx}.name`]} />
                  <Input aria-label="Tilberedning" value={r.preparation} onChange={(e) => updIng(r.key, { preparation: e.target.value })} placeholder="hakket" className="col-span-3 sm:col-span-1" />
                </div>
              )}
              <div className="flex">
                <button type="button" className="rounded-full p-2.5 text-ink-muted hover:bg-sand disabled:opacity-30" onClick={() => setIngs((rs) => move(rs, idx, idx - 1))} disabled={idx === 0} aria-label="Flyt op"><ArrowUp className="size-4" /></button>
                <button type="button" className="rounded-full p-2.5 text-ink-muted hover:bg-sand disabled:opacity-30" onClick={() => setIngs((rs) => move(rs, idx, idx + 1))} disabled={idx === ings.length - 1} aria-label="Flyt ned"><ArrowDown className="size-4" /></button>
                <button type="button" className="rounded-full p-2.5 text-ink-muted hover:bg-danger-soft hover:text-danger" onClick={() => setIngs((rs) => rs.filter((x) => x.key !== r.key))} aria-label="Fjern"><Trash2 className="size-4" /></button>
              </div>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => setIngs((rs) => [...rs, { key: k(), kind: 'item', qty: '', unit: '', name: '', preparation: '', is_optional: false, is_scalable: true }])}><Plus className="size-4" aria-hidden /> Ingrediens</Button>
          <Button variant="ghost" size="sm" onClick={() => setIngs((rs) => [...rs, { key: k(), kind: 'section', title: '' }])}><Heading className="size-4" aria-hidden /> Sektion</Button>
          <Button variant="ghost" size="sm" onClick={() => setPaste('ingredients')}><ClipboardPaste className="size-4" aria-hidden /> Indsæt liste</Button>
        </div>
      </Section>

      <Section title="Fremgangsmåde">
        <ol className="flex flex-col gap-3">
          {steps.map((s, idx) => (
            <li key={s.key} className="grid grid-cols-[2rem_1fr_auto] items-start gap-2">
              <span className="mt-2.5 flex size-7 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand-dark" aria-hidden>{idx + 1}</span>
              <div className="flex flex-col gap-1.5">
                <Textarea aria-label={`Trin ${idx + 1}`} rows={2} value={s.body} onChange={(e) => setSteps((ss) => ss.map((x) => (x.key === s.key ? { ...x, body: e.target.value } : x)))} />
                <label className="flex items-center gap-2 text-xs text-ink-muted">Timer (min, valgfri)
                  <Input value={s.minutes} inputMode="numeric" onChange={(e) => setSteps((ss) => ss.map((x) => (x.key === s.key ? { ...x, minutes: e.target.value.replace(/[^\d.]/g, '') } : x)))} className="min-h-8 w-20 py-1 text-sm" />
                </label>
              </div>
              <div className="flex flex-col">
                <button type="button" className="rounded-full p-2 text-ink-muted hover:bg-sand disabled:opacity-30" onClick={() => setSteps((ss) => move(ss, idx, idx - 1))} disabled={idx === 0} aria-label="Flyt op"><ArrowUp className="size-4" /></button>
                <button type="button" className="rounded-full p-2 text-ink-muted hover:bg-sand disabled:opacity-30" onClick={() => setSteps((ss) => move(ss, idx, idx + 1))} disabled={idx === steps.length - 1} aria-label="Flyt ned"><ArrowDown className="size-4" /></button>
                <button type="button" className="rounded-full p-2 text-ink-muted hover:bg-danger-soft hover:text-danger" onClick={() => setSteps((ss) => ss.filter((x) => x.key !== s.key))} aria-label="Fjern trin"><Trash2 className="size-4" /></button>
              </div>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => setSteps((ss) => [...ss, { key: k(), body: '', minutes: '' }])}><Plus className="size-4" aria-hidden /> Trin</Button>
          <Button variant="ghost" size="sm" onClick={() => setPaste('steps')}><ClipboardPaste className="size-4" aria-hidden /> Indsæt tekst</Button>
        </div>
        <Field label="Gode råd og noter" htmlFor={id('notes')}>
          <Textarea id={id('notes')} rows={3} value={basics.notes} onChange={(e) => set({ notes: e.target.value })} />
        </Field>
      </Section>

      <Section title="Familiehistorie" description="Hvem kommer opskriften fra? Historier og gamle billeder kan tilføjes på opskriftens side.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Kommer fra (person)" htmlFor={id('person')} error={errors.origin_person_id}>
            <Select id={id('person')} value={basics.origin_person_id} onChange={(e) => set({ origin_person_id: e.target.value })}>
              <option value="">Ingen valgt</option>
              {people.map((p) => <option key={p.id} value={p.id}>{p.name}{p.relation ? ` (${p.relation})` : ''}</option>)}
            </Select>
            <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
              <Input aria-label="Nyt navn" value={newPerson.name} onChange={(e) => setNewPerson((p) => ({ ...p, name: e.target.value }))} placeholder="Nyt navn" />
              <Input aria-label="Relation" value={newPerson.relation} onChange={(e) => setNewPerson((p) => ({ ...p, relation: e.target.value }))} placeholder="Fx Oldemor" />
              <Button variant="secondary" onClick={addPerson} disabled={!newPerson.name.trim() || pending}>Tilføj</Button>
            </div>
          </Field>
          <Field label="Eller beskriv oprindelsen" htmlFor={id('otext')} hint="Fx “Mormor Karen fra Vejle”"><Input id={id('otext')} value={basics.origin_text} onChange={(e) => set({ origin_text: e.target.value })} maxLength={300} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="År" htmlFor={id('oyear')} error={errors.origin_year}><Input id={id('oyear')} inputMode="numeric" value={basics.origin_year} onChange={(e) => set({ origin_year: e.target.value.replace(/\D/g, '').slice(0, 4) })} placeholder="1955" /></Field>
          <label className="mt-7 flex items-center gap-2 text-sm"><input type="checkbox" checked={basics.origin_year_approx} onChange={(e) => set({ origin_year_approx: e.target.checked })} className="size-5 accent-[var(--vk-terracotta)]" /> Cirka-årstal</label>
        </div>
      </Section>

      <Section title="Kilde">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Kilde (bog, blad, person)" htmlFor={id('sname')}><Input id={id('sname')} value={basics.source_name} onChange={(e) => set({ source_name: e.target.value })} /></Field>
          <Field label="Link" htmlFor={id('surl')} error={errors.source_url}><Input id={id('surl')} type="url" value={basics.source_url} onChange={(e) => set({ source_url: e.target.value })} placeholder="https://" /></Field>
        </div>
      </Section>

      <div className="sticky bottom-20 z-10 flex items-center justify-end gap-2 rounded-full border border-line bg-paper/95 p-2 shadow-lg backdrop-blur lg:bottom-4">
        <Button variant="ghost" onClick={() => router.back()}>Annullér</Button>
        <Button onClick={onSave} disabled={pending} size="lg">{pending ? <Spinner /> : null} {mode === 'create' ? 'Opret opskrift' : 'Gem ændringer'}</Button>
      </div>

      {paste ? (
        <div role="dialog" aria-modal="true" aria-label="Indsæt tekst" className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center">
          <Card className="w-full max-w-lg p-5">
            <h2 className="text-xl font-semibold">{paste === 'ingredients' ? 'Indsæt ingrediensliste' : 'Indsæt fremgangsmåde'}</h2>
            <p className="mt-1 text-sm text-ink-soft">{paste === 'ingredients' ? 'Én ingrediens pr. linje. Linjer der ender med kolon bliver til sektioner.' : 'Adskil trin med en tom linje eller nummerering.'}</p>
            <Textarea autoFocus rows={10} value={pasteText} onChange={(e) => setPasteText(e.target.value)} className="mt-3" aria-label="Tekst" />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setPaste(null)}>Annullér</Button>
              <Button onClick={applyPaste}>Tilføj</Button>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
