'use client';
import { useState } from 'react';
import { newsletterConsent } from '@/lib/newsletter';
export function NewsletterSignup({ email, configured }: { email: string; configured: boolean }) {
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(
    'Kontrollér din nuværende tilmelding eller tilmeld dig nedenfor.',
  );
  async function action(subscribe?: boolean) {
    setBusy(true);
    setMessage('Et øjeblik …');
    try {
      const r = await fetch('/api/newsletter', {
        method: subscribe === undefined ? 'GET' : 'POST',
        headers: subscribe === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: subscribe === undefined ? undefined : JSON.stringify({ subscribe, confirm: consent }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error);
      setState(data.subscribed);
      setMessage(
        data.subscribed
          ? 'Du er tilmeldt. Jeg glæder mig til at dele nyt fra køkkenet med dig.'
          : 'Du er ikke tilmeldt AkselsMads nyhedsbrev.',
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Handlingen kunne ikke gennemføres.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="newsletter-signup">
      <span className="eyebrow">ET BREV FRA MIT KØKKEN</span>
      <h2>Madglæde i din indbakke.</h2>
      <p>
        Du tilmelder dig med <strong>{email}</strong>.
      </p>
      {!configured ? (
        <p>Nyhedsbrevet åbner snart. Du kan stadig læse alle opskrifter og guides.</p>
      ) : (
        <>
          <p role="status" aria-live="polite">
            {message}
          </p>
          {state !== true ? (
            <label className="newsletter-consent">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                disabled={busy}
              />
              <span>{newsletterConsent}</span>
            </label>
          ) : null}
          <div className="actions">
            {state !== true ? (
              <button disabled={busy || !consent} onClick={() => action(true)}>
                Tilmeld nyhedsbrevet →
              </button>
            ) : null}
            <button className="secondary" disabled={busy} onClick={() => action()}>
              Kontrollér tilmelding
            </button>
            <button className="secondary" disabled={busy} onClick={() => action(false)}>
              Afmeld nyhedsbrevet
            </button>
          </div>
        </>
      )}
    </div>
  );
}
