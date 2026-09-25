'use client';
import { addNote, deleteNote, toDataError } from '@vores-kok/database';
import { noteInputSchema, type RecipeNote } from '@vores-kok/validation';
import { Lock, Trash2, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition, type FormEvent } from 'react';
import { getBrowserClient } from '@/lib/supabase/client';
import { Alert, Button, Select, Textarea } from '../ui';

export function NotesSection({ notes, recipeId, householdId, userId, canShare }: { notes: RecipeNote[]; recipeId: string; householdId: string; userId: string; canShare: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const parsed = noteInputSchema.safeParse({ body: f.get('body'), visibility: f.get('visibility') ?? 'private' });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message);
    start(async () => {
      try {
        await addNote(getBrowserClient(), { recipe_id: recipeId, household_id: householdId, user_id: userId, ...parsed.data });
        form.reset();
        setError(undefined);
        router.refresh();
      } catch (err) { setError(toDataError(err).message); }
    });
  }
  return (
    <section aria-labelledby="notes-heading" className="no-print">
      <h2 id="notes-heading" className="mb-4 text-2xl font-semibold">Noter</h2>
      <ul className="mb-4 flex flex-col gap-3">
        {notes.map((n) => (
          <li key={n.id} className="rounded-xl border border-line bg-paper p-4">
            <p className="whitespace-pre-wrap">{n.body}</p>
            <div className="mt-2 flex items-center gap-2 text-xs text-ink-muted">
              {n.visibility === 'private' ? <><Lock className="size-3.5" aria-hidden /> Kun dig</> : <><Users className="size-3.5" aria-hidden /> {n.author_name}</>}
              <span>· {new Date(n.created_at).toLocaleDateString('da-DK')}</span>
              {n.user_id === userId ? (
                <button type="button" className="ml-auto rounded-full p-1.5 text-danger hover:bg-danger-soft" aria-label="Slet note"
                  onClick={() => start(async () => { try { await deleteNote(getBrowserClient(), n.id); router.refresh(); } catch (e) { setError(toDataError(e).message); } })}>
                  <Trash2 className="size-4" />
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      <form onSubmit={onSubmit} className="flex flex-col gap-2">
        {error ? <Alert>{error}</Alert> : null}
        <label htmlFor="note-body" className="sr-only">Ny note</label>
        <Textarea id="note-body" name="body" rows={3} placeholder="Tilføj en note — fx “brug lidt mindre sukker”" />
        <div className="flex flex-wrap items-center gap-2">
          <Select name="visibility" aria-label="Hvem kan se noten" className="w-auto" defaultValue="private">
            <option value="private">Kun mig</option>
            {canShare ? <option value="household">Hele husstanden</option> : null}
          </Select>
          <Button type="submit" variant="secondary" disabled={pending}>Gem note</Button>
        </div>
      </form>
    </section>
  );
}
