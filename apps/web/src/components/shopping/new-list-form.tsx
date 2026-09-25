'use client';
import { createShoppingList, toDataError } from '@vores-kok/database';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { getBrowserClient } from '@/lib/supabase/client';
import { Alert, Button, Input } from '../ui';

export function NewListForm({ householdId }: { householdId: string }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <form method="post" className="flex flex-col gap-2" onSubmit={(e) => {
      e.preventDefault();
      if (!name.trim()) return;
      start(async () => {
        try { const l = await createShoppingList(getBrowserClient(), householdId, name); router.push(`/shopping/${l.id}`); }
        catch (err) { setError(toDataError(err).message); }
      });
    }}>
      {error ? <Alert>{error}</Alert> : null}
      <div className="flex gap-2">
        <Input aria-label="Navn på ny liste" value={name} onChange={(e) => setName(e.target.value)} placeholder="Fx Weekendindkøb" maxLength={100} />
        <Button type="submit" disabled={pending || !name.trim()}><Plus className="size-5" aria-hidden /> Ny liste</Button>
      </div>
    </form>
  );
}
