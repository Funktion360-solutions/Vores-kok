import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePublisher } from '@/lib/data';
import { AdminImport } from '@/components/admin-import';
import { articleStatus, type Article, type ArticleDraft } from '@/lib/editorial';
import type { Draft } from '@/lib/model';
export const metadata: Metadata = {
  title: 'Administration',
  robots: { index: false, follow: false },
};
export default async function Admin({
  searchParams,
}: {
  searchParams: Promise<{ recipe?: string; q?: string; status?: string }>;
}) {
  const filters = await searchParams;
  const selected = filters.recipe;
  const { client } = await requirePublisher();
  const [drafts, recipes, published, articleDrafts, articlePublic] = await Promise.all([
    client.from('am_drafts').select('*').order('updated_at', { ascending: false }),
    client.from('recipes').select('id,title,household_id').is('archived_at', null).order('title'),
    client.from('am_recipes').select('id,visible,published_revision'),
    client.from('am_article_drafts').select('*'),
    client.from('am_articles').select('*'),
  ]);
  if (
    drafts.error ||
    recipes.error ||
    published.error ||
    articleDrafts.error ||
    articlePublic.error
  )
    throw new Error('Administrationen kunne ikke hente data.');
  const pubs = new Map(published.data.map((p) => [p.id, p]));
  const articlePubs = new Map((articlePublic.data as Article[]).map((a) => [a.id, a]));
  const term = typeof filters.q === 'string' ? filters.q.toLocaleLowerCase('da').slice(0, 200) : '';
  const filtered = (drafts.data as Draft[]).filter((d) => {
    const status = pubs.get(d.id)?.visible ? 'Udgivet' : 'Kladde';
    return (
      (!term || d.content.title.toLocaleLowerCase('da').includes(term)) &&
      (!filters.status || filters.status === status)
    );
  });
  const now = new Date().getTime();
  const plan = (articleDrafts.data as ArticleDraft[]).filter(
    (d) => articleStatus(articlePubs.get(d.id), d.revision, now) === 'Planlagt',
  ).length;
  return (
    <section className="section">
      <span className="eyebrow">AKSELSMAD · REDAKTION</span>
      <h1>Velkommen til redaktionen.</h1>
      <p className="lede">
        Dine opskrifter, guides og fortællinger samlet ét sted. Fra første idé til godkendt
        udgivelse.
      </p>
      <div className="editorial-stats">
        <div>
          <strong>{drafts.data.length}</strong>
          <span>Opskriftskladder</span>
        </div>
        <div>
          <strong>{published.data.filter((p) => p.visible).length}</strong>
          <span>Offentlige opskrifter</span>
        </div>
        <div>
          <strong>{articleDrafts.data.length}</strong>
          <span>Guides og blogindlæg</span>
        </div>
        <div>
          <strong>{plan}</strong>
          <span>Planlagte artikler</span>
        </div>
      </div>
      <nav className="editorial-admin-nav" aria-label="Redaktion">
        <a href="#opskrifter">Opskrifter</a>
        <Link href="/admin/indhold">Guides og blog ↗</Link>
        <Link href="/admin/indhold/ny">Skriv nyt indhold ↗</Link>
      </nav>
      <div className="admin-intro">
        <div>
          <h2>Hent fra Vores Kok</h2>
          <p>
            Kun opskriftens grunddata, ingredienser og trin kopieres. Private historier, noter,
            kildefiler og billeder følger ikke med.
          </p>
          <AdminImport recipes={recipes.data || []} selected={selected} />
        </div>
        <div>
          <h2>Begynd fra bunden</h2>
          <p>Skriv en ny opskrift direkte til AkselsMad.</p>
          <Link className="button secondary" href="/admin/ny">
            Ny kladde ↗
          </Link>
        </div>
      </div>
      <h2 id="opskrifter">Dine opskrifter</h2>
      <form method="get" className="editorial-filters">
        <label>
          Søg i opskrifter
          <input
            name="q"
            defaultValue={typeof filters.q === 'string' ? filters.q : ''}
            maxLength={200}
          />
        </label>
        <label>
          Status
          <select name="status" defaultValue={filters.status || ''}>
            <option value="">Alle</option>
            <option>Kladde</option>
            <option>Udgivet</option>
          </select>
        </label>
        <button type="submit">Filtrér</button>
        <Link href="/admin">Nulstil</Link>
      </form>
      {!filtered.length ? (
        <div className="empty">Ingen opskrifter matcher. Opret en kladde eller ændr filtrene.</div>
      ) : (
        <div className="draft-list">
          {filtered.map((d) => {
            const p = pubs.get(d.id);
            return (
              <Link key={d.id} href={'/admin/' + d.id}>
                <div>
                  <h3>{d.content.title}</h3>
                  <p>
                    {d.source_recipe_id ? 'Fra Vores Kok' : 'Skrevet i AkselsMad'} · Version{' '}
                    {d.revision}
                  </p>
                </div>
                <span className="status">
                  {p?.visible
                    ? p.published_revision === d.revision
                      ? 'Udgivet'
                      : 'Udgivet · nye ændringer i kladde'
                    : 'Kladde'}{' '}
                  ↗
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
