'use client';
import Link from 'next/link';
import { Heart, FolderPlus } from 'lucide-react';
import { useState } from 'react';
import { personalAction, type Collection } from '@/lib/personal';
export function RecipePersonal({
  id,
  slug,
  signedIn,
  favorite,
  collections,
  memberships,
}: {
  id: string;
  slug: string;
  signedIn: boolean;
  favorite: boolean;
  collections: Collection[];
  memberships: string[];
}) {
  const [saved, setSaved] = useState(favorite);
  const [items, setItems] = useState(memberships);
  const [collection, setCollection] = useState(collections[0]?.id || '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function change(item: boolean) {
    const next = item ? !items.includes(collection) : !saved;
    setBusy(true);
    setMessage('');
    try {
      await personalAction({
        action: item ? 'item' : 'favorite',
        recipe_id: id,
        collection_id: collection,
        saved: next,
      });
      if (item)
        setItems((previous) =>
          next ? [...previous, collection] : previous.filter((value) => value !== collection),
        );
      else setSaved(next);
      setMessage(
        next
          ? item
            ? 'Opskriften er føjet til samlingen.'
            : 'Opskriften er gemt som favorit.'
          : 'Opskriften er fjernet.',
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Kunne ikke gemme.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="section personal-panel no-print">
      <span className="eyebrow">DIN EGEN INSPIRATION</span>
      <h2>Gem til næste gang.</h2>
      {!signedIn ? (
        <>
          <p>Gem favoritter og saml opskrifter til hverdag, gæster eller weekendbagning.</p>
          <Link
            className="button"
            href={'/login?next=' + encodeURIComponent('/opskrifter/' + slug)}
          >
            Log ind og gem opskriften
          </Link>
        </>
      ) : (
        <>
          <div className="actions">
            <button
              className={saved ? '' : 'secondary'}
              aria-pressed={saved}
              disabled={busy}
              onClick={() => change(false)}
            >
              <Heart size={18} fill={saved ? 'currentColor' : 'none'} />
              {saved ? 'Gemt som favorit' : 'Gem som favorit'}
            </button>
            <Link href="/konto/kogebog">Mine favoritter og samlinger ↗</Link>
          </div>
          {collections.length ? (
            <div className="collection-picker">
              <label htmlFor="recipe-collection">Vælg din samling</label>
              <select
                id="recipe-collection"
                value={collection}
                disabled={busy}
                onChange={(e) => setCollection(e.target.value)}
              >
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button className="secondary" disabled={busy} onClick={() => change(true)}>
                <FolderPlus size={18} />
                {items.includes(collection) ? 'Fjern fra samlingen' : 'Føj til samlingen'}
              </button>
            </div>
          ) : (
            <p className="small">
              Opret din første samling under{' '}
              <Link href="/konto/kogebog">Mine favoritter og samlinger</Link>.
            </p>
          )}
          <p role="status" aria-live="polite">
            {busy ? 'Gemmer…' : message}
          </p>
        </>
      )}
    </section>
  );
}
