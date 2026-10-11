'use client';
import Link from 'next/link';
import { useState } from 'react';
import { newsletterStatus } from '@/lib/newsletter';
import {
  filterNewsletters,
  newsletterFilters,
  type NewsletterSummary,
  type NewsletterFilter,
} from '@/lib/newsletter-workspace';
export function NewsletterCampaignList({ campaigns }: { campaigns: NewsletterSummary[] }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<NewsletterFilter>('all');
  const [sort, setSort] = useState<'recent' | 'oldest' | 'subject'>('recent');
  const filtered = filterNewsletters(campaigns, search, status, sort);
  return (
    <section className="newsletter-campaigns" aria-labelledby="newsletter-campaigns-title">
      <h2 id="newsletter-campaigns-title">Dine breve</h2>
      <div className="newsletter-overview">
        {(['all', 'draft', 'ready', 'progress', 'sent'] as const).map((key) => (
          <button
            key={key}
            type="button"
            className={status === key ? 'is-active' : ''}
            aria-pressed={status === key}
            onClick={() => setStatus(key)}
          >
            <strong>{filterNewsletters(campaigns, '', key, 'recent').length}</strong>
            <span>{newsletterFilters[key]}</span>
          </button>
        ))}
      </div>
      <div className="newsletter-list-filters">
        <label>
          Søg i breve
          <input
            type="search"
            value={search}
            maxLength={200}
            placeholder="Emne eller overskrift …"
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label>
          Vis
          <select value={status} onChange={(e) => setStatus(e.target.value as NewsletterFilter)}>
            {Object.entries(newsletterFilters).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Rækkefølge
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
            <option value="recent">Senest ændret først</option>
            <option value="oldest">Ældst ændret først</option>
            <option value="subject">Emne A–Å</option>
          </select>
        </label>
        <button
          type="button"
          className="secondary"
          onClick={() => {
            setSearch('');
            setStatus('all');
            setSort('recent');
          }}
        >
          Nulstil
        </button>
      </div>
      <p className="muted" role="status">
        {filtered.length} af {campaigns.length} breve
      </p>
      <div className="newsletter-campaign-list">
        {filtered.length ? (
          filtered.map((c) => (
            <article key={c.id} className="newsletter-campaign-row">
              <Link className="newsletter-campaign-main" href={'/admin/nyhedsbrev/' + c.id}>
                <div>
                  <h3>{c.subject}</h3>
                  <p>{c.title}</p>
                  <small>
                    Version {c.revision} ·{' '}
                    <time dateTime={c.updated_at}>
                      {new Date(c.updated_at).toLocaleDateString('da-DK', {
                        timeZone: 'Europe/Copenhagen',
                      })}
                    </time>
                  </small>
                </div>
                <span className="status">{newsletterStatus[c.status]} ↗</span>
              </Link>
              {c.status === 'draft' || c.status === 'sent' ? (
                <Link className="newsletter-copy-link" href={'/admin/nyhedsbrev/ny?copy=' + c.id}>
                  Genbrug som ny kladde →
                </Link>
              ) : (
                <p className="newsletter-copy-help">Afklar udsendelsen før du genbruger brevet.</p>
              )}
            </article>
          ))
        ) : (
          <div className="empty">
            <h3>{campaigns.length ? 'Ingen breve matcher.' : 'Dit første brev starter her.'}</h3>
            <p>
              {campaigns.length
                ? 'Prøv et andet søgeord eller nulstil filtrene.'
                : 'Vælg en skabelon ovenfor, eller begynd med dit eget brev.'}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
