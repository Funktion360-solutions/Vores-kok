'use client';
import { useState } from 'react';
import Link from 'next/link';
export function CopyToKitchen({
  id,
  households,
  signedIn,
  slug,
}: {
  id: string;
  households: { id: string; name: string }[];
  signedIn: boolean;
  slug: string;
}) {
  const [household, setHousehold] = useState(households[0]?.id || '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [url, setUrl] = useState('');
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
      setUrl(result.url);
      setMessage('Opskriften er gemt som din egen kopi.');
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
        Opret først en familie i{' '}
        <a href={process.env.NEXT_PUBLIC_VORES_KOK_URL || 'https://voreskok.funktion360.dk'}>
          Vores Kok
        </a>
        .
      </p>
    );
  return (
    <div>
      <label>
        Din kogebog
        <select value={household} onChange={(e) => setHousehold(e.target.value)}>
          {households.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </select>
      </label>
      <button disabled={busy || !!url} onClick={save}>
        {busy ? 'Gemmer…' : 'Gem i Vores Kok'}
      </button>
      <p role="status">{message}</p>
      {url ? (
        <a className="button secondary" href={url}>
          Åbn din kopi i Vores Kok ↗
        </a>
      ) : null}
    </div>
  );
}
