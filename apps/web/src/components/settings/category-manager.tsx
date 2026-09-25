'use client';
import { deleteCategory, saveCategory, toDataError, type Category } from '@vores-kok/database';
import { Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { getBrowserClient } from '@/lib/supabase/client';
import { CategoryIcon, ICON_CHOICES } from '../recipe/category-icon';
import { Alert, Button, Card, Input, Select } from '../ui';

export function CategoryManager({ categories, householdId, canEdit, canDelete }: { categories: Category[]; householdId: string; canEdit: boolean; canDelete: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [name, setName] = useState('');
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<unknown>) => start(async () => { try { await fn(); setError(undefined); router.refresh(); } catch (e) { setError(toDataError(e).message); } });
  return (
    <Card className="p-6">
      <h2 className="text-xl font-semibold">Kategorier</h2>
      {error ? <div className="mt-3"><Alert>{error}</Alert></div> : null}
      <ul className="mt-4 divide-y divide-line">
        {categories.map((c) => (
          <li key={c.id} className="flex items-center gap-2 py-2">
            <span className="text-brand"><CategoryIcon icon={c.icon} /></span>
            {canEdit ? (
              <>
                <Input aria-label="Navn" defaultValue={c.name} className="flex-1" onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== c.name) run(() => saveCategory(getBrowserClient(), { id: c.id, household_id: householdId, name: v, icon: c.icon })); }} />
                <Select aria-label="Ikon" value={c.icon} className="w-32" onChange={(e) => run(() => saveCategory(getBrowserClient(), { id: c.id, household_id: householdId, name: c.name, icon: e.target.value }))}>
                  {ICON_CHOICES.map((i) => <option key={i} value={i}>{i}</option>)}
                </Select>
              </>
            ) : <span className="flex-1">{c.name}</span>}
            {canDelete ? (
              <button type="button" className="rounded-full p-2 text-danger hover:bg-danger-soft" aria-label={`Slet ${c.name}`}
                onClick={() => { if (confirm(`Slet kategorien “${c.name}”? Opskrifterne bevares uden kategori.`)) run(() => deleteCategory(getBrowserClient(), c.id)); }}>
                <Trash2 className="size-4" />
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {canEdit ? (
        <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) run(async () => { await saveCategory(getBrowserClient(), { household_id: householdId, name: name.trim() }); setName(''); }); }}>
          <Input aria-label="Ny kategori" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ny kategori" />
          <Button type="submit" variant="secondary" disabled={pending}>Tilføj</Button>
        </form>
      ) : null}
    </Card>
  );
}
