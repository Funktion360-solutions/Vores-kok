'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
export function AdminImport({
  recipes,
  selected,
}: {
  recipes: { id: string; title: string }[];
  selected?: string;
}) {
  const [id, setId] = useState(recipes.find((r) => r.id === selected)?.id || recipes[0]?.id || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  async function load() {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'import', id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push('/admin/' + data.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke hente opskriften.');
      setBusy(false);
    }
  }
  return (
    <div>
      <label>
        Opskrift fra din private kogebog
        <select value={id} onChange={(e) => setId(e.target.value)}>
          {recipes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.title}
            </option>
          ))}
        </select>
      </label>
      <button disabled={!id || busy} onClick={load}>
        {busy ? 'Henter…' : 'Opret offentlig kladde'}
      </button>
      {!recipes.length ? <p>Ingen opskrifter i de familier, du har adgang til.</p> : null}
      <p role="alert">{error}</p>
    </div>
  );
}
