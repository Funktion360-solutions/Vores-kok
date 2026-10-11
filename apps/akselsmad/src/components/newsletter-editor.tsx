'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TextEditor } from './text-editor';
import {
  newsletterStatus,
  type NewsletterCampaign,
  type NewsletterContent,
  type NewsletterItem,
} from '@/lib/newsletter';
const empty: NewsletterContent = {
  subject: 'Nyt fra Aksels køkken',
  preheader: 'Opskrifter, guides og madglæde til dit køkken.',
  title: 'Velkommen indenfor i mit køkken',
  intro:
    'Her er lidt nyt fra mit køkken. Jeg håber, du finder inspiration til noget, du har lyst til at lave.',
  closing: 'Tak, fordi du læser med.',
  items: [],
};
export function NewsletterEditor({
  initial,
  items,
  email,
  configured,
}: {
  initial: NewsletterCampaign | null;
  items: NewsletterItem[];
  email: string;
  configured: boolean;
}) {
  const router = useRouter();
  const [campaign, setCampaign] = useState(initial);
  const [content, setContent] = useState<NewsletterContent>(initial?.content || empty);
  const [html, setHtml] = useState(initial?.html_body || '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [provider, setProvider] = useState('');
  const [filter, setFilter] = useState('');
  const editable = !campaign || campaign.status === 'draft';
  const dirty = !campaign || JSON.stringify(content) !== JSON.stringify(campaign.content);
  function change(key: keyof Omit<NewsletterContent, 'items'>, value: string) {
    setContent((c) => ({ ...c, [key]: value }));
    setHtml('');
  }
  async function action(action: string) {
    setBusy(true);
    setMessage('Et øjeblik …');
    try {
      const r = await fetch('/api/newsletter/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          id: campaign?.id || null,
          revision: campaign?.revision,
          content,
          confirm,
          provider_id: provider,
          nonce: crypto.randomUUID(),
        }),
      });
      const result = await r.json();
      if (!r.ok) throw Error(result.error);
      if (result.campaign) {
        setCampaign(result.campaign);
        setContent(result.campaign.content);
        if (result.campaign.html_body) setHtml(result.campaign.html_body);
        if (!campaign) router.replace('/admin/nyhedsbrev/' + result.campaign.id);
      }
      if (result.html) setHtml(result.html);
      setConfirm(false);
      setMessage(
        result.message ||
          {
            save: 'Kladden er gemt.',
            preview: 'Forhåndsvisningen er klar.',
            prepare:
              'Brevet er gemt som kladde i Resend. Kontrollér forhåndsvisningen før du godkender.',
            send: 'Resend har accepteret udsendelsen. Opdatér status for at følge den.',
            attach: 'Resend-kladden er forbundet.',
          }[action] ||
          'Handlingen er gennemført.',
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Handlingen kunne ikke gennemføres.');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }
  const filtered = items.filter((i) =>
    (i.title + ' ' + i.kind).toLocaleLowerCase('da').includes(filter.toLocaleLowerCase('da')),
  );
  return (
    <section className="section newsletter-editor">
      <div className="newsletter-editor-heading">
        <div>
          <Link href="/admin/nyhedsbrev">← Alle nyhedsbreve</Link>
          <h1>{campaign ? 'Dit nyhedsbrev.' : 'Et nyt brev fra køkkenet.'}</h1>
        </div>
        <span className="status">{campaign ? newsletterStatus[campaign.status] : 'Ny kladde'}</span>
      </div>
      {!configured ? (
        <aside className="newsletter-note">
          <strong>Mailopsætningen mangler.</strong>
          <p>
            Du kan skrive og gemme kladder nu. Sæt Resend-nøglen, afsenderen og AkselsMad-segmentet
            i Vercel, før du tester eller sender. Se{' '}
            <a href="https://resend.com/segments" target="_blank" rel="noreferrer">
              Resend
            </a>{' '}
            og opsætningsguiden i projektets docs/akselsmad-newsletter.md.
          </p>
        </aside>
      ) : null}
      <p className="newsletter-feedback" role="status" aria-live="polite">
        {message}
      </p>
      <div className="newsletter-editor-grid">
        <div className="newsletter-write">
          <fieldset disabled={busy || !editable}>
            <legend>Indhold i brevet</legend>
            <label>
              Emnelinje
              <input
                value={content.subject}
                maxLength={200}
                onChange={(e) => change('subject', e.target.value)}
              />
            </label>
            <label>
              Forhåndstekst i indbakken
              <input
                value={content.preheader}
                maxLength={180}
                onChange={(e) => change('preheader', e.target.value)}
              />
            </label>
            <label>
              Overskrift
              <input
                value={content.title}
                maxLength={180}
                onChange={(e) => change('title', e.target.value)}
              />
            </label>
            <TextEditor
              label="Indledning"
              value={content.intro}
              onChange={(v) => change('intro', v)}
              rows={7}
            />
            <h2>Fra din kogebog og blog</h2>
            <p>Vælg højst seks offentlige indslag. De kommer med som kort med links.</p>
            <label>
              Søg efter et indslag
              <input value={filter} onChange={(e) => setFilter(e.target.value)} />
            </label>
            <div className="newsletter-picks">
              {filtered.map((i) => {
                const checked = content.items.some((x) => x.id === i.id && x.kind === i.kind);
                return (
                  <label key={i.kind + i.id}>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!checked && content.items.length >= 6}
                      onChange={() => {
                        setContent((c) => ({
                          ...c,
                          items: checked
                            ? c.items.filter((x) => x.id !== i.id || x.kind !== i.kind)
                            : [...c.items, { id: i.id, kind: i.kind }],
                        }));
                        setHtml('');
                      }}
                    />
                    <span>
                      <small>
                        {i.kind === 'recipe' ? 'Opskrift' : i.kind === 'guide' ? 'Guide' : 'Blog'}
                      </small>
                      {i.title}
                    </span>
                  </label>
                );
              })}
              {!filtered.length ? <p>Ingen offentlige indslag matcher din søgning.</p> : null}
            </div>
            <TextEditor
              label="Afslutning"
              value={content.closing}
              onChange={(v) => change('closing', v)}
            />
          </fieldset>
          <div className="actions">
            {editable ? (
              <button disabled={busy} onClick={() => action('save')}>
                Gem kladde
              </button>
            ) : null}
            <button className="secondary" disabled={busy} onClick={() => action('preview')}>
              Forhåndsvis mail
            </button>
          </div>
        </div>
        <aside className="newsletter-review">
          <h2>Sådan ser brevet ud</h2>
          {html ? (
            <iframe
              title="Forhåndsvisning af nyhedsbrevet"
              srcDoc={html}
              sandbox=""
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="newsletter-preview-empty">
              Gem din tekst og tryk på Forhåndsvis mail. Her ser du brevets farver, formatering og
              opskriftskort.
            </div>
          )}
          <div className="newsletter-send">
            <h3>Test og godkendelse</h3>
            <p>
              Testmailen sendes kun til din redaktørkonto: <strong>{email}</strong>.
            </p>
            <button
              className="secondary"
              disabled={busy || !configured || !campaign || dirty}
              onClick={() => action('test')}
            >
              Send test til mig
            </button>
            {dirty ? (
              <p className="muted">Gem ændringerne før du tester eller gør brevet klar.</p>
            ) : null}
            {campaign?.status === 'draft' ? (
              <>
                <p>Når du gør brevet klar, låses indholdet som en Resend-kladde.</p>
                <button disabled={busy || !configured || dirty} onClick={() => action('prepare')}>
                  Gør klar til udsendelse →
                </button>
              </>
            ) : null}
            {campaign?.status === 'ready' ? (
              <>
                <label className="newsletter-consent">
                  <input
                    type="checkbox"
                    checked={confirm}
                    disabled={busy}
                    onChange={(e) => setConfirm(e.target.checked)}
                  />
                  <span>
                    Jeg har kontrolleret brevet og godkender udsendelse til AkselsMads tilmeldte
                    læsere.
                  </span>
                </label>
                <button disabled={busy || !configured || !confirm} onClick={() => action('send')}>
                  Godkend og send nyhedsbrevet
                </button>
              </>
            ) : null}
            {campaign?.status === 'preparing' ? (
              <div className="newsletter-note">
                <p>
                  En Resend-kladde kan allerede være oprettet. Genindlæs siden først. Find brevet
                  med navnet <strong>AkselsMad:{campaign.id}</strong> i Resend og forbind dets ID.
                  Opret ikke en ny kopi for at prøve igen.
                </p>
                <label>
                  Resend Broadcast-ID
                  <input value={provider} onChange={(e) => setProvider(e.target.value)} />
                </label>
                <button
                  disabled={busy || !configured || !provider}
                  onClick={() => action('attach')}
                >
                  Forbind eksisterende kladde
                </button>
              </div>
            ) : null}
            {campaign && ['sending', 'submitted', 'sent'].includes(campaign.status) ? (
              <p>
                Udsendelsen følges hos Resend. Hvis forbindelsen blev afbrudt, kontrollér det
                eksisterende brev i Resend før du foretager dig mere.
              </p>
            ) : null}
            {campaign?.provider_id ? (
              <>
                <button
                  className="secondary"
                  disabled={busy || !configured}
                  onClick={() => action('status')}
                >
                  Opdatér status fra Resend
                </button>
                <a href="https://resend.com/broadcasts" target="_blank" rel="noreferrer">
                  Åbn Resend ↗
                </a>
              </>
            ) : null}
          </div>
        </aside>
      </div>
    </section>
  );
}
