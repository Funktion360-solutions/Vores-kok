'use client';
import { deleteRecipe, setRecipeArchived, toDataError } from '@vores-kok/database';
import { Archive, ArchiveRestore, History, Pencil, Printer, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { getBrowserClient } from '@/lib/supabase/client';
import { Button, buttonClass } from '../ui';

export function RecipeActions({ recipeId, title, canEdit, canDelete, archived }: { recipeId: string; title: string; canEdit: boolean; canDelete: boolean; archived: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const run = (fn: () => Promise<void>) => start(async () => {
    try { await fn(); } catch (e) { alert(toDataError(e).message); }
  });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canEdit ? <Link href={`/recipes/${recipeId}/edit`} className={buttonClass('primary')}><Pencil className="size-4" aria-hidden /> Rediger</Link> : null}
      <Button variant="secondary" onClick={() => window.print()}><Printer className="size-4" aria-hidden /> Print / PDF</Button>
      <Link href={`/recipes/${recipeId}/history`} className={buttonClass('ghost')}><History className="size-4" aria-hidden /> Historik</Link>
      {canEdit ? (
        <Button variant="ghost" disabled={pending} onClick={() => run(async () => { await setRecipeArchived(getBrowserClient(), recipeId, !archived); router.refresh(); })}>
          {archived ? <><ArchiveRestore className="size-4" aria-hidden /> Gendan</> : <><Archive className="size-4" aria-hidden /> Arkivér</>}
        </Button>
      ) : null}
      {canDelete ? (
        confirming ? (
          <span role="alertdialog" aria-label="Bekræft sletning" className="flex items-center gap-2 rounded-full bg-danger-soft px-3 py-1 text-sm text-danger">
            Slet “{title}” permanent?
            <Button size="sm" variant="danger" disabled={pending} onClick={() => run(async () => { await deleteRecipe(getBrowserClient(), recipeId); router.replace('/recipes'); router.refresh(); })}>Slet</Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>Annullér</Button>
          </span>
        ) : (
          <Button variant="ghost" className="text-danger" onClick={() => setConfirming(true)}><Trash2 className="size-4" aria-hidden /> Slet</Button>
        )
      ) : null}
    </div>
  );
}
