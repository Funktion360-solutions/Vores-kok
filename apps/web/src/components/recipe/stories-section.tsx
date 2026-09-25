'use client';
import { deleteStory, saveStory, toDataError, type Person } from '@vores-kok/database';
import type { RecipeStory } from '@vores-kok/validation';
import { storyInputSchema, fieldErrors } from '@vores-kok/validation';
import { BookHeart, Pencil, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition, type FormEvent } from 'react';
import { getBrowserClient } from '@/lib/supabase/client';
import { Alert, Button, Field, Input, Select, Textarea } from '../ui';

function StoryForm({ story, recipeId, householdId, people, onDone }: { story?: RecipeStory; recipeId: string; householdId: string; people: Person[]; onDone: () => void }) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const parsed = storyInputSchema.safeParse({
      id: story?.id, recipe_id: recipeId, household_id: householdId,
      title: f.get('title'), body: f.get('body'), person_id: f.get('person_id'), told_by: f.get('told_by'),
      approx_year: f.get('approx_year'), historical_context: f.get('historical_context'),
    });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    start(async () => {
      try {
        await saveStory(getBrowserClient(), parsed.data);
        onDone();
        router.refresh();
      } catch (err) { setErrors({ _: toDataError(err).message }); }
    });
  }
  return (
    <form onSubmit={onSubmit} className="grid gap-3 rounded-xl border border-line bg-paper p-4">
      {errors._ ? <Alert>{errors._}</Alert> : null}
      <Field label="Overskrift (valgfri)" htmlFor="st-title"><Input id="st-title" name="title" defaultValue={story?.title ?? ''} placeholder="Fx “Julen hos oldemor”" /></Field>
      <Field label="Historien" htmlFor="st-body" error={errors.body}>
        <Textarea id="st-body" name="body" rows={6} defaultValue={story?.body ?? ''} placeholder="Hvem lavede den, hvornår, og hvad husker I?" />
      </Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Handler om" htmlFor="st-person">
          <Select id="st-person" name="person_id" defaultValue={story?.person_id ?? ''}>
            <option value="">Ingen bestemt person</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Field>
        <Field label="Fortalt af" htmlFor="st-told"><Input id="st-told" name="told_by" defaultValue={story?.told_by ?? ''} /></Field>
        <Field label="Cirka år" htmlFor="st-year" error={errors.approx_year}><Input id="st-year" name="approx_year" inputMode="numeric" defaultValue={story?.approx_year ?? ''} /></Field>
      </div>
      <Field label="Historisk sammenhæng (valgfri)" htmlFor="st-ctx"><Textarea id="st-ctx" name="historical_context" rows={2} defaultValue={story?.historical_context ?? ''} placeholder="Fx rationering under krigen, gården i Vestjylland…" /></Field>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>Gem historie</Button>
        <Button variant="ghost" onClick={onDone}>Annullér</Button>
      </div>
    </form>
  );
}

export function StoriesSection({ stories, recipeId, householdId, people, canEdit }: { stories: RecipeStory[]; recipeId: string; householdId: string; people: Person[]; canEdit: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [, start] = useTransition();
  return (
    <section aria-labelledby="stories-heading">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id="stories-heading" className="flex items-center gap-2 text-2xl font-semibold"><BookHeart className="size-6 text-brand" aria-hidden /> Historien bag</h2>
        {canEdit && editing !== 'new' ? <Button variant="soft" size="sm" onClick={() => setEditing('new')} className="no-print"><Plus className="size-4" aria-hidden /> Tilføj historie</Button> : null}
      </div>
      {editing === 'new' ? <div className="mb-4"><StoryForm recipeId={recipeId} householdId={householdId} people={people} onDone={() => setEditing(null)} /></div> : null}
      {stories.length === 0 && editing !== 'new' ? (
        <p className="text-ink-muted">Der er endnu ingen historie. Hvem lærte jer at lave den her?</p>
      ) : null}
      <div className="flex flex-col gap-4">
        {stories.map((s) => editing === s.id ? (
          <StoryForm key={s.id} story={s} recipeId={recipeId} householdId={householdId} people={people} onDone={() => setEditing(null)} />
        ) : (
          <article key={s.id} className="rounded-xl border border-line bg-honey-soft/50 p-5">
            {s.title ? <h3 className="mb-2 font-display text-xl font-semibold">{s.title}</h3> : null}
            <p className="whitespace-pre-wrap font-display text-[17px] leading-relaxed text-ink">{s.body}</p>
            {s.historical_context ? <p className="mt-3 whitespace-pre-wrap text-sm text-ink-soft">{s.historical_context}</p> : null}
            <footer className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
              {s.person_name ? <span>Om {s.person_name}</span> : null}
              {s.told_by ? <span>Fortalt af {s.told_by}</span> : null}
              {s.approx_year ? <span>ca. {s.approx_year}</span> : null}
              {canEdit ? (
                <span className="no-print ml-auto flex gap-1">
                  <button type="button" onClick={() => setEditing(s.id)} className="rounded-full p-2 hover:bg-sand" aria-label="Redigér historie"><Pencil className="size-4" /></button>
                  <button type="button" onClick={() => { if (confirm('Slet historien?')) start(async () => { try { await deleteStory(getBrowserClient(), s.id); router.refresh(); } catch (e) { alert(toDataError(e).message); } }); }}
                    className="rounded-full p-2 text-danger hover:bg-danger-soft" aria-label="Slet historie"><Trash2 className="size-4" /></button>
                </span>
              ) : null}
            </footer>
          </article>
        ))}
      </div>
    </section>
  );
}
