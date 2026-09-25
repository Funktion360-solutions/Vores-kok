'use client';
import type { Household } from '@vores-kok/database';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { switchHousehold } from '@/app/actions';

export function HouseholdSwitcher({ households, currentId }: { households: Household[]; currentId: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  if (households.length < 2) {
    return <span className="truncate text-sm text-ink-soft">{households[0]?.name}</span>;
  }
  return (
    <label className="flex items-center gap-2 text-sm text-ink-soft">
      <span className="sr-only">Skift husstand</span>
      <select value={currentId} disabled={pending}
        onChange={(e) => start(async () => { await switchHousehold(e.target.value); router.push('/'); router.refresh(); })}
        className="max-w-48 truncate rounded-full border border-line bg-paper px-3 py-1.5 text-sm text-ink">
        {households.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
      </select>
    </label>
  );
}
