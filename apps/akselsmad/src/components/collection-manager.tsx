'use client';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { personalAction, type Collection } from '@/lib/personal';
export function CollectionManager({ selected }: { selected: Collection | null }) {
  const [name, setName] = useState('');
  const [rename, setRename] = useState(selected?.name || '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [confirm, setConfirm] = useState(false);
  const router = useRouter();
  async function action(type: string, e?: FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      await personalAction({
        action: type,
        id: selected?.id,
        name: type === 'create' ? name : rename,
      });
      setMessage(
        type === 'delete'
          ? 'Samlingen er slettet. Opskrifter og favoritter er bevaret.'
          : 'Samlingen er gemt.',
      );
      if (type === 'create') setName('');
      if (type === 'delete') router.push('/konto/kogebog');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Kunne ikke gemme.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="collection-manager">
      <form onSubmit={(e) => action('create', e)}>
        <label htmlFor="new-collection">Ny samling</label>
        <div className="actions">
          <input
            id="new-collection"
            required
            maxLength={80}
            value={name}
            placeholder="Fx Italienske aftener"
            onChange={(e) => setName(e.target.value)}
          />
          <button disabled={busy}>Opret samling</button>
        </div>
      </form>
      {selected ? (
        <div className="collection-edit">
          <form onSubmit={(e) => action('rename', e)}>
            <label htmlFor="rename-collection">Samlingens navn</label>
            <div className="actions">
              <input
                id="rename-collection"
                required
                maxLength={80}
                value={rename}
                onChange={(e) => setRename(e.target.value)}
              />
              <button className="secondary" disabled={busy}>
                Gem navn
              </button>
            </div>
          </form>
          <details>
            <summary>Slet denne samling</summary>
            <p>Samlingens indhold fjernes. Opskrifterne og dine favoritter bliver bevaret.</p>
            <label className="delete-confirm">
              <input
                type="checkbox"
                checked={confirm}
                onChange={(e) => setConfirm(e.target.checked)}
              />
              Jeg vil slette samlingen
            </label>
            <button
              className="secondary"
              disabled={busy || !confirm}
              onClick={() => action('delete')}
            >
              Slet samling
            </button>
          </details>
        </div>
      ) : null}
      <p role="status" aria-live="polite">
        {busy ? 'Gemmer…' : message}
      </p>
    </div>
  );
}
export function RemoveSaved({
  recipeId,
  collectionId,
}: {
  recipeId: string;
  collectionId?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  async function remove() {
    setBusy(true);
    setError('');
    try {
      await personalAction({
        action: collectionId ? 'item' : 'favorite',
        recipe_id: recipeId,
        collection_id: collectionId,
        saved: false,
      });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke fjerne opskriften.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="saved-card-action">
      <button className="secondary" disabled={busy} onClick={remove}>
        {busy ? 'Fjerner…' : collectionId ? 'Fjern fra samlingen' : 'Fjern favorit'}
      </button>
      <p role="status">{error}</p>
    </div>
  );
}
