'use client';
import { useState } from 'react';
import Link from 'next/link';
type KitchenCopy = { recipe_id: string; household_id: string; public_revision: number };
export function CopyToKitchen({
  id,
  households,
  signedIn,
  slug,
  copies,
  publicRevision,
}: {
  id: string;
  households: { id: string; name: string }[];
  signedIn: boolean;
  slug: string;
  copies: KitchenCopy[];
  publicRevision: number;
}) {
  const [household, setHousehold] = useState(households[0]?.id || '');
  const [savedCopies, setSavedCopies] = useState<KitchenCopy[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const existing = [...copies, ...savedCopies]
    .sort((a, b) => b.public_revision - a.public_revision)
    .find((c) => c.household_id === household);
  const origin = process.env.NEXT_PUBLIC_VORES_KOK_URL || 'https://voreskok.funktion360.dk';
  async function save() {
    setBusy(true);
    setMessage('');
    try {
      const res = await fetch('/api/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, household_id: household }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      const recipeId = result.id;
      setSavedCopies((previous) => [
        ...previous,
        { recipe_id: recipeId, household_id: household, public_revision: result.revision ?? 0 },
      ]);
      setMessage('Opskriften er gemt i familiens kogebog.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Kunne ikke gemme opskriften.');
    } finally {
      setBusy(false);
    }
  }
  if (!signedIn)
    return (
      <Link className="button" href={'/login?next=' + encodeURIComponent('/opskrifter/' + slug)}>
        Log ind med Funktion360
      </Link>
    );
  if (!households.length)
    return (
      <p>
        Opret først en familie i <a href={origin}>Vores Kok</a>.
      </p>
    );
  return (
    <div>
      <label>
        Din kogebog
        <select
          value={household}
          disabled={busy}
          onChange={(e) => {
            setHousehold(e.target.value);
            setMessage('');
          }}
        >
          {households.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </select>
      </label>
      {existing ? (
        <>
          <p>
            {existing.public_revision < publicRevision
              ? 'Du har allerede en kopi. Originalen er opdateret; du kan godkende den nye udgave i Vores Kok.'
              : 'Opskriften findes allerede i denne families kogebog.'}
          </p>
          <a
            className="button secondary"
            href={new URL('/recipes/' + existing.recipe_id, origin).href}
          >
            Åbn familiens kopi ↗
          </a>
        </>
      ) : (
        <button disabled={busy} onClick={save}>
          {busy ? 'Gemmer…' : 'Gem i Vores Kok'}
        </button>
      )}
      <p role="status">{message}</p>
    </div>
  );
}
