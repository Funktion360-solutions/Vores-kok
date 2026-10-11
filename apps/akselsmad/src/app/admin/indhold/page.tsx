import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePublisher } from '@/lib/data';
import { articleStatus, type Article, type ArticleDraft } from '@/lib/editorial';
export const metadata: Metadata = {
  title: 'Guides og blog · Redaktion',
  robots: { index: false, follow: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; status?: string }>;
}) {
  const p = await searchParams;
  const { client } = await requirePublisher();
  const [drafts, published] = await Promise.all([
    client.from('am_article_drafts').select('*').order('updated_at', { ascending: false }),
    client.from('am_articles').select('*'),
  ]);
  if (drafts.error || published.error) throw new Error('Indholdet kunne ikke hentes.');
  const live = new Map((published.data as Article[]).map((a) => [a.id, a]));
  const term = typeof p.q === 'string' ? p.q.toLocaleLowerCase('da').slice(0, 200) : '';
  const now = new Date().getTime();
  const rows = (drafts.data as ArticleDraft[]).filter(
    (d) =>
      (!term ||
        (d.content.title + ' ' + d.content.category).toLocaleLowerCase('da').includes(term)) &&
      (!p.type || d.kind === p.type) &&
      (!p.status || articleStatus(live.get(d.id), d.revision, now).startsWith(p.status)),
  );
  return (
    <section className="section">
      <Link href="/admin">← Redaktionens overblik</Link>
      <span className="eyebrow">GUIDES & BLOG</span>
      <h1>Ord fra mit køkken.</h1>
      <p className="lede">
        Skriv en guide, del en fortælling og vælg, hvornår den skal møde læserne.
      </p>
      <Link className="button" href="/admin/indhold/ny">
        Ny guide eller blogindlæg ↗
      </Link>
      <form method="get" className="editorial-filters">
        <label>
          Søg
          <input name="q" defaultValue={typeof p.q === 'string' ? p.q : ''} maxLength={200} />
        </label>
        <label>
          Type
          <select name="type" defaultValue={p.type || ''}>
            <option value="">Alle typer</option>
            <option value="guide">Guides</option>
            <option value="blog">Blog</option>
          </select>
        </label>
        <label>
          Status
          <select name="status" defaultValue={p.status || ''}>
            <option value="">Alle statusser</option>
            <option>Kladde</option>
            <option>Udgivet</option>
            <option>Planlagt</option>
          </select>
        </label>
        <button type="submit">Filtrér</button>
        <Link href="/admin/indhold">Nulstil</Link>
      </form>
      <p className="muted">
        {rows.length} af {drafts.data.length} udgivelser
      </p>
      {rows.length ? (
        <div className="draft-list">
          {rows.map((d) => {
            const a = live.get(d.id);
            return (
              <Link key={d.id} href={'/admin/indhold/' + d.id}>
                <div>
                  <span className="eyebrow">
                    {d.kind === 'guide' ? 'GUIDE' : 'BLOG'} · {d.content.category}
                  </span>
                  <h3>{d.content.title}</h3>
                  <p>
                    Version {d.revision} · Senest gemt{' '}
                    {new Date(d.updated_at).toLocaleDateString('da-DK', {
                      timeZone: 'Europe/Copenhagen',
                    })}
                    {a?.visible && Date.parse(a.published_at) > now
                      ? ' · Udgives ' +
                        new Date(a.published_at).toLocaleString('da-DK', {
                          timeZone: 'Europe/Copenhagen',
                        }) +
                        ' (dansk tid)'
                      : ''}
                  </p>
                </div>
                <span className="status">{articleStatus(a, d.revision, now)} ↗</span>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="empty">
          <h2>{drafts.data.length ? 'Ingen match.' : 'Din første fortælling venter.'}</h2>
          <p>Opret en guide eller et blogindlæg, og gem det som kladde.</p>
        </div>
      )}
    </section>
  );
}
