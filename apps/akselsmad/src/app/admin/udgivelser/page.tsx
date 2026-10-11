import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePublisher } from '@/lib/data';
import type { EditionDraft, Edition } from '@/lib/editions';
export const metadata: Metadata = {
  title: 'Temaforløb og kogebøger · Redaktion',
  robots: { index: false, follow: false },
};
export default async function Page() {
  const { client, user } = await requirePublisher();
  const drafts: EditionDraft[] = [];
  for (let start = 0; ; start += 200) {
    const r = await client
      .from('am_edition_drafts')
      .select('*')
      .eq('owner_id', user.id)
      .order('updated_at', { ascending: false })
      .order('id')
      .range(start, start + 199);
    if (r.error) throw new Error('Udgivelserne kunne ikke hentes.');
    drafts.push(...(r.data as EditionDraft[]));
    if (r.data.length < 200) break;
  }
  const published: Edition[] = [];
  for (let start = 0; start < drafts.length; start += 200) {
    const r = await client
      .from('am_editions')
      .select('*')
      .in(
        'id',
        drafts.slice(start, start + 200).map((d) => d.id),
      );
    if (r.error) throw new Error('Udgivelserne kunne ikke hentes.');
    published.push(...(r.data as Edition[]));
  }
  const live = new Map(published.map((e) => [e.id, e]));
  return (
    <section className="section">
      <Link href="/admin">← Redaktionens overblik</Link>
      <span className="eyebrow">MADGLÆDE MED SAMMENHÆNG</span>
      <h1>Temaforløb og kogebøger.</h1>
      <p className="lede">
        Pasta, salater, gæstemiddage og bagning. Saml dit køkken i udgivelser, som læserne kan gå på
        opdagelse i.
      </p>
      <div className="edition-admin-start">
        <Link href="/admin/udgivelser/ny?kind=course">
          <span className="eyebrow">TAG LÆSEREN MED</span>
          <h2>Nyt temaforløb</h2>
          <p>Trin, introduktioner og opskrifter med gemt fremgang.</p>
          <span>Opret forløb ↗</span>
        </Link>
        <Link href="/admin/udgivelser/ny?kind=book">
          <span className="eyebrow">SAML DINE FAVORITTER</span>
          <h2>Ny digital kogebog</h2>
          <p>Kapitler, fortællinger og dine egne opskrifter.</p>
          <span>Opret kogebog ↗</span>
        </Link>
      </div>
      <div className="edition-starters">
        <p>Begynd med en ramme, du selv fylder ud:</p>
        <Link href="/admin/udgivelser/ny?kind=course&theme=italian">
          En italiensk gæstemiddag ↗
        </Link>
        <Link href="/admin/udgivelser/ny?kind=course&theme=pasta">Pasta fra bunden ↗</Link>
        <Link href="/admin/udgivelser/ny?kind=book&theme=salads">Salater med karakter ↗</Link>
      </div>
      {drafts.length ? (
        <div className="draft-list">
          {drafts.map((d) => {
            const p = live.get(d.id);
            return (
              <Link key={d.id} href={'/admin/udgivelser/' + d.id}>
                <div>
                  <span className="eyebrow">
                    {d.kind === 'course' ? 'TEMAFORLØB' : 'KOGEBOG'} · {d.content.category}
                  </span>
                  <h3>{d.content.title}</h3>
                  <p>
                    {d.content.chapters.length} {d.kind === 'course' ? 'trin' : 'kapitler'} ·
                    Kladdens version {d.revision}
                  </p>
                </div>
                <span className="status">
                  {p?.visible
                    ? p.published_revision === d.revision
                      ? 'Udgivet'
                      : 'Udgivet · nye ændringer'
                    : 'Kladde'}{' '}
                  ↗
                </span>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="empty">
          <h2>Din første udgivelse venter.</h2>
          <p>Opret en kladde, vælg dit indhold, og godkend den, når den er klar.</p>
        </div>
      )}
    </section>
  );
}
