'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button } from '../ui';
export type KitchenStatus = {
  recipe_id: string;
  household_id: string;
  copied_revision: number;
  private_version: number;
  modified: boolean;
  public_revision: number;
  available: boolean;
  slug: string | null;
  title: string | null;
};
export function AkselsMadUpdateAction({ status }: { status: KitchenStatus }) {
  const [newCopy, setNewCopy] = useState(status.modified);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const router = useRouter();
  async function update() {
    setBusy(true);
    setError(undefined);
    try {
      const response = await fetch('/api/akselsmad-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: status.recipe_id,
          public_revision: status.public_revision,
          private_version: status.private_version,
          confirm: confirmed,
          new_copy: newCopy,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      router.push('/recipes/' + result.id);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Opdateringen kunne ikke gemmes.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-4 space-y-4">
      <p className="text-sm leading-relaxed">
        {status.modified
          ? 'Familien har ændret eller tilføjet noget til denne kopi. Den nye udgave gemmes som en ekstra opskrift, så jeres tilpasninger bevares.'
          : 'Der er ingen ændringer i familiens kopi siden importen. Du kan opdatere den eller gemme en ekstra udgave.'}
      </p>
      {!status.modified ? (
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={newCopy}
            disabled={busy}
            onChange={(e) => {
              setNewCopy(e.target.checked);
              setConfirmed(false);
            }}
          />
          Gem som en ekstra opskrift
        </label>
      ) : null}
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={confirmed}
          disabled={busy}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        {newCopy
          ? 'Jeg vil gemme den nye udgave som en ekstra opskrift.'
          : 'Jeg godkender, at denne kopi opdateres til den nye udgave.'}
      </label>
      {error ? <Alert>{error}</Alert> : null}
      <Button disabled={busy || !confirmed} onClick={update}>
        {busy ? 'Gemmer…' : newCopy ? 'Gem den nye udgave' : 'Opdater min kopi'}
      </Button>
    </div>
  );
}
