'use client';
import { useState } from 'react';
import { Share2, Link2, Printer } from 'lucide-react';
export function ArticleActions({ title, url }: { title: string; url?: string }) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function copy() {
    if (!url) return;
    setBusy(true);
    try {
      await navigator.clipboard.writeText(url);
      setMessage('Linket er kopieret.');
    } catch {
      setMessage(
        'Linket kunne ikke kopieres automatisk. Kopiér adressen fra browserens adresselinje.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function share() {
    if (!url) return;
    if (!navigator.share) {
      await copy();
      return;
    }
    setBusy(true);
    try {
      await navigator.share({ title, url });
      setMessage('Delingsmenuen er åbnet.');
    } catch (error) {
      if (!(error instanceof Error && error.name === 'AbortError'))
        setMessage('Deling kunne ikke åbnes. Brug Kopiér link i stedet.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="article-actions">
      <div role="group" aria-label="Værktøjer til artiklen">
        {url ? (
          <>
            <button type="button" className="secondary" disabled={busy} onClick={share}>
              <Share2 size={16} aria-hidden="true" />
              Del artiklen
            </button>
            <button type="button" className="secondary" disabled={busy} onClick={copy}>
              <Link2 size={16} aria-hidden="true" />
              Kopiér link
            </button>
          </>
        ) : null}
        <button type="button" className="secondary" onClick={() => window.print()}>
          <Printer size={16} aria-hidden="true" />
          Udskriv
        </button>
      </div>
      <p role="status" aria-live="polite">
        {message}
      </p>
    </div>
  );
}
