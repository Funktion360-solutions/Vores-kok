'use client';
import { useState } from 'react';
export function NewsletterAudience({ configured }: { configured: boolean }) {
  const [people, setPeople] = useState<{ id: string; email: string; unsubscribed: boolean }[]>([]);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function load(next = false) {
    setBusy(true);
    try {
      const r = await fetch('/api/newsletter/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'audience', after: next ? people.at(-1)?.id : undefined }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error);
      setPeople((p) => (next ? [...p, ...data.data] : data.data));
      setMore(data.has_more);
      setMessage('Modtagere hentet fra AkselsMad-segmentet i Resend.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Modtagerlisten kunne ikke hentes.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="newsletter-audience">
      <h2>Dine læsere</h2>
      <p>Kun personer i AkselsMad-segmentet. Resend udelukker afmeldte adresser ved udsendelse.</p>
      <button className="secondary" disabled={busy || !configured} onClick={() => load()}>
        Hent modtagere fra Resend
      </button>
      <p role="status">{message}</p>
      {people.length ? (
        <>
          <p>
            {more ? 'Mindst ' : ''}
            {people.length} adresser hentet · {people.filter((p) => !p.unsubscribed).length}{' '}
            tilmeldte blandt disse.
          </p>
          <div className="newsletter-table">
            <table>
              <thead>
                <tr>
                  <th>E-mail</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {people.map((p) => (
                  <tr key={p.id}>
                    <td>{p.email}</td>
                    <td>{p.unsubscribed ? 'Afmeldt hos Resend' : 'Tilmeldt'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
      {more ? (
        <button disabled={busy} className="secondary" onClick={() => load(true)}>
          Hent næste 100
        </button>
      ) : null}
    </section>
  );
}
