import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePublisher } from '@/lib/data';
import type { Article, ArticleDraft } from '@/lib/editorial';
import {
  calendarEntries,
  calendarMonth,
  danishDay,
  monthDays,
  shiftMonth,
} from '@/lib/editorial-calendar';
export const metadata: Metadata = {
  title: 'Redaktionskalender',
  robots: { index: false, follow: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; type?: string }>;
}) {
  const params = await searchParams;
  const { client, user } = await requirePublisher();
  const drafts: ArticleDraft[] = [];
  for (let start = 0; ; start += 200) {
    const result = await client
      .from('am_article_drafts')
      .select('*')
      .eq('owner_id', user.id)
      .order('updated_at', { ascending: false })
      .order('id')
      .range(start, start + 199);
    if (result.error) throw new Error('Kalenderen kunne ikke hentes. Prøv igen.');
    drafts.push(...(result.data as ArticleDraft[]));
    if (result.data.length < 200) break;
  }
  const published: Article[] = [];
  for (let start = 0; start < drafts.length; start += 200) {
    const result = await client
      .from('am_articles')
      .select('*')
      .in(
        'id',
        drafts.slice(start, start + 200).map((d) => d.id),
      );
    if (result.error) throw new Error('Kalenderen kunne ikke hentes. Prøv igen.');
    published.push(...(result.data as Article[]));
  }
  const now = new Date().getTime();
  const month = calendarMonth(params.month, now);
  const kind = params.type === 'guide' || params.type === 'blog' ? params.type : '';
  const entries = calendarEntries(drafts, published, now).filter(
    (e) => !kind || e.draft.kind === kind,
  );
  const dated = entries
    .filter((e) => e.day.startsWith(month))
    .sort((a, b) => Date.parse(a.article!.published_at) - Date.parse(b.article!.published_at));
  const undated = entries.filter((e) => !e.day);
  const days = monthDays(month);
  const byDay = new Map<string, typeof entries>();
  for (const entry of entries)
    if (entry.day) byDay.set(entry.day, [...(byDay.get(entry.day) || []), entry]);
  const href = (value: string) => '/admin/kalender?month=' + value + (kind ? '&type=' + kind : '');
  const title = new Date(month + '-15T12:00:00Z').toLocaleDateString('da-DK', {
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Copenhagen',
  });
  return (
    <section className="section editorial-calendar">
      <Link href="/admin">← Redaktionens overblik</Link>
      <span className="eyebrow">DIT KØKKEN · DIN REDAKTION</span>
      <h1>Plads til næste fortælling.</h1>
      <p className="lede">
        Dine guides og blogindlæg, samlet i en kalender. Alle datoer og tider vises i dansk tid.
      </p>
      <nav className="editorial-admin-nav" aria-label="Kalenderværktøjer">
        <Link className="button" href="/admin/indhold/ny">
          Ny guide eller blogindlæg ↗
        </Link>
        <Link href="/admin/indhold">Se alle udgivelser</Link>
      </nav>
      <form className="editorial-filters" method="get">
        <label>
          Måned
          <input type="month" name="month" min="2000-01" max="2099-12" defaultValue={month} />
        </label>
        <label>
          Indhold
          <select name="type" defaultValue={kind}>
            <option value="">Guides og blog</option>
            <option value="guide">Guides</option>
            <option value="blog">Blog</option>
          </select>
        </label>
        <button type="submit">Vis kalender</button>
        <Link href="/admin/kalender">Denne måned</Link>
      </form>
      <div className="calendar-toolbar">
        <Link href={href(shiftMonth(month, -1))} aria-label="Forrige måned">
          ←
        </Link>
        <h2>{title}</h2>
        <Link href={href(shiftMonth(month, 1))} aria-label="Næste måned">
          →
        </Link>
      </div>
      <div className="calendar-month" aria-label={'Udgivelser i ' + title}>
        {['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag'].map((day) => (
          <div className="calendar-weekday" key={day}>
            <abbr title={day}>{day.slice(0, 3)}</abbr>
          </div>
        ))}
        {days.map((day) => (
          <div
            key={day}
            className={
              'calendar-day' +
              (!day.startsWith(month) ? ' calendar-outside' : '') +
              (day === danishDay(now) ? ' calendar-today' : '')
            }
          >
            <time
              dateTime={day}
              aria-label={new Date(day + 'T12:00:00Z').toLocaleDateString('da-DK', {
                dateStyle: 'full',
                timeZone: 'Europe/Copenhagen',
              })}
            >
              {Number(day.slice(-2))}
            </time>
            {(byDay.get(day) || []).map((e) => (
              <Link
                className={'calendar-entry ' + (e.status === 'Planlagt' ? 'calendar-planned' : '')}
                key={e.draft.id}
                href={'/admin/indhold/' + e.draft.id}
              >
                <span>
                  {e.draft.kind === 'guide' ? 'Guide' : 'Blog'} ·{' '}
                  {e.status === 'Planlagt' ? 'Planlagt' : 'Udgivet'}
                </span>
                <strong>{e.article!.content.title}</strong>
                {e.changed ? <small>Nye ændringer i kladden</small> : null}
              </Link>
            ))}
          </div>
        ))}
      </div>
      <section className="calendar-agenda" aria-labelledby="agenda-title">
        <h2 id="agenda-title">Månedens udgivelser</h2>
        {dated.length ? (
          <div className="draft-list">
            {dated.map((e) => (
              <Link key={e.draft.id} href={'/admin/indhold/' + e.draft.id}>
                <div>
                  <span className="eyebrow">
                    {e.draft.kind === 'guide' ? 'GUIDE' : 'BLOG'} ·{' '}
                    {new Date(e.article!.published_at).toLocaleString('da-DK', {
                      timeZone: 'Europe/Copenhagen',
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </span>
                  <h3>{e.article!.content.title}</h3>
                  {e.changed ? (
                    <p>Kladden har ændringer, som ikke er med i den godkendte udgivelse.</p>
                  ) : null}
                </div>
                <span className="status">{e.status} ↗</span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="empty">
            Ingen udgivelser i denne måned. Vælg en udgivelsesdato i redigeringen af en guide eller
            et blogindlæg.
          </p>
        )}
      </section>
      <section aria-labelledby="draft-title">
        <h2 id="draft-title">
          Kladder uden udgivelsesdato <span className="muted">({undated.length})</span>
        </h2>
        <p>
          Åbn en kladde, og godkend udgivelsen med den ønskede dato. Kalenderen viser den senest
          godkendte version.
        </p>
        {undated.length ? (
          <div className="draft-list">
            {undated.map((e) => (
              <Link key={e.draft.id} href={'/admin/indhold/' + e.draft.id}>
                <div>
                  <span className="eyebrow">
                    {e.draft.kind === 'guide' ? 'GUIDE' : 'BLOG'} · {e.draft.content.category}
                  </span>
                  <h3>{e.draft.content.title}</h3>
                </div>
                <span className="status">Kladde ↗</span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="muted">Ingen kladder uden dato.</p>
        )}
      </section>
    </section>
  );
}
