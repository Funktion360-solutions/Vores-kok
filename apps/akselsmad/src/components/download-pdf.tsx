'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Download } from 'lucide-react';
export function DownloadPdf({
  id,
  slug,
  signedIn,
  used,
  downloaded,
  compact = false,
}: {
  id: string;
  slug: string;
  signedIn: boolean;
  used: number;
  downloaded: boolean;
  compact?: boolean;
}) {
  const [count, setCount] = useState(used);
  const [saved, setSaved] = useState(downloaded);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function download() {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!response.ok) {
        if (response.status === 429) setCount(5);
        const result = await response.json();
        throw new Error(result.error);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'akselsmad-' + slug + '.pdf';
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setCount(Number(response.headers.get('X-PDF-Used')) || count);
      setSaved(true);
      setMessage('Din PDF er klar. Tjek browserens downloads.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'PDF kunne ikke hentes.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="section download-panel no-print">
      {!compact ? (
        <>
          <span className="eyebrow">TAG OPSKRIFTEN MED</span>
          <h2>Din opskrift som PDF.</h2>
          <p>
            Ingredienser, alle trin og de detaljerede noter i et format, du kan gemme eller printe.
          </p>
        </>
      ) : null}
      {!signedIn ? (
        <>
          <p>
            Med din konto kan du hente fem forskellige opskrifter i alt. Samme opskrift kan hentes
            igen uden at bruge en ekstra plads.
          </p>
          <Link
            className="button"
            href={'/login?next=' + encodeURIComponent('/opskrifter/' + slug)}
          >
            Log ind for at hente PDF
          </Link>
        </>
      ) : (
        <>
          <p>
            <strong>{count} af 5 opskrifter hentet.</strong>{' '}
            {saved
              ? 'Denne opskrift kan hentes igen uden at bruge en ekstra plads.'
              : count >= 5
                ? 'Alle pladser er brugt. Dine tidligere PDF-opskrifter findes under din konto.'
                : 'Denne opskrift bruger én plads første gang.'}
          </p>
          <div className="actions">
            <button disabled={busy || (!saved && count >= 5)} onClick={download}>
              <Download size={18} />
              {busy ? 'Opretter PDF…' : saved ? 'Hent PDF igen' : 'Hent opskrift som PDF'}
            </button>
            <Link href="/konto/downloads">Mine PDF-opskrifter ↗</Link>
          </div>
          <p role="status" aria-live="polite">
            {message}
          </p>
        </>
      )}
    </section>
  );
}
