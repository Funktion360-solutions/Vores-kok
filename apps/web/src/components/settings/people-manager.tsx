'use client';
import { deletePerson, savePerson, toDataError, type Person } from '@vores-kok/database';
import { fieldErrors, personSchema } from '@vores-kok/validation';
import { Pencil, Plus, Trash2, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition, type FormEvent } from 'react';
import { getBrowserClient } from '@/lib/supabase/client';
import { Alert, Button, Card, EmptyState, Field, Input, Textarea } from '../ui';

function PersonForm({ person, householdId, onDone }: { person?: Person; householdId: string; onDone: () => void }) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const parsed = personSchema.safeParse({ id: person?.id, household_id: householdId, name: f.get('name'), relation: f.get('relation'), birth_year: f.get('birth_year'), death_year: f.get('death_year'), bio: f.get('bio') });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    start(async () => {
      try { await savePerson(getBrowserClient(), parsed.data); onDone(); router.refresh(); } catch (err) { setErrors({ _: toDataError(err).message }); }
    });
  }
  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      {errors._ ? <Alert>{errors._}</Alert> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Navn" htmlFor="p-name" error={errors.name}><Input id="p-name" name="name" defaultValue={person?.name} /></Field>
        <Field label="Relation" htmlFor="p-rel" hint="Fx Oldemor, Farfar, Tante Grete"><Input id="p-rel" name="relation" defaultValue={person?.relation ?? ''} /></Field>
        <Field label="Født (år)" htmlFor="p-born" error={errors.birth_year}><Input id="p-born" name="birth_year" inputMode="numeric" defaultValue={person?.birth_year ?? ''} /></Field>
        <Field label="Død (år)" htmlFor="p-died" error={errors.death_year}><Input id="p-died" name="death_year" inputMode="numeric" defaultValue={person?.death_year ?? ''} /></Field>
      </div>
      <Field label="Om personen" htmlFor="p-bio"><Textarea id="p-bio" name="bio" rows={4} defaultValue={person?.bio ?? ''} /></Field>
      <div className="flex gap-2"><Button type="submit" disabled={pending}>Gem</Button><Button variant="ghost" onClick={onDone}>Annullér</Button></div>
    </form>
  );
}

export function PeopleManager({ people, counts, householdId, canEdit, canDelete }: { people: Person[]; counts: Record<string, number>; householdId: string; canEdit: boolean; canDelete: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [, start] = useTransition();
  return (
    <div className="flex flex-col gap-4">
      {canEdit ? (editing === 'new' ? <Card className="p-5"><PersonForm householdId={householdId} onDone={() => setEditing(null)} /></Card> : <div><Button onClick={() => setEditing('new')}><Plus className="size-4" aria-hidden /> Tilføj person</Button></div>) : null}
      {people.length === 0 && editing !== 'new' ? (
        <EmptyState title="Ingen personer endnu" icon={<UserRound className="size-10" />}>Tilføj fx oldemor, farmor eller onkel Jens — og knyt deres opskrifter og historier til dem.</EmptyState>
      ) : null}
      <ul className="grid gap-4 sm:grid-cols-2">
        {people.map((p) => (
          <li key={p.id}>
            <Card className="h-full p-5">
              {editing === p.id ? <PersonForm person={p} householdId={householdId} onDone={() => setEditing(null)} /> : (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="text-xl font-semibold">{p.name}</h2>
                      <p className="text-sm text-ink-muted">{[p.relation, p.birth_year ? `${p.birth_year}${p.death_year ? `–${p.death_year}` : ''}` : null].filter(Boolean).join(' · ')}</p>
                    </div>
                    <div className="flex">
                      {canEdit ? <button type="button" onClick={() => setEditing(p.id)} className="rounded-full p-2 hover:bg-sand" aria-label={`Redigér ${p.name}`}><Pencil className="size-4" /></button> : null}
                      {canDelete ? <button type="button" onClick={() => { if (confirm(`Slet ${p.name}? Opskrifterne bevares.`)) start(async () => { try { await deletePerson(getBrowserClient(), p.id); router.refresh(); } catch (e) { alert(toDataError(e).message); } }); }} className="rounded-full p-2 text-danger hover:bg-danger-soft" aria-label={`Slet ${p.name}`}><Trash2 className="size-4" /></button> : null}
                    </div>
                  </div>
                  {p.bio ? <p className="mt-3 line-clamp-4 whitespace-pre-wrap text-ink-soft">{p.bio}</p> : null}
                  <Link href={`/recipes?person=${p.id}`} className="mt-4 inline-block text-sm font-medium text-brand hover:underline">
                    {counts[p.id] ? `${counts[p.id]} ${counts[p.id] === 1 ? 'opskrift' : 'opskrifter'} →` : 'Ingen opskrifter endnu'}
                  </Link>
                </>
              )}
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
