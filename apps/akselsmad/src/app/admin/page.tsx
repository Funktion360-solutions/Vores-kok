import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePublisher } from '@/lib/data';
import { AdminImport } from '@/components/admin-import';
import type { Draft } from '@/lib/model';
export const metadata: Metadata = {
  title: 'Administration',
  robots: { index: false, follow: false },
};
export default async function Admin({
  searchParams,
}: {
  searchParams: Promise<{ recipe?: string }>;
}) {
  const selected = (await searchParams).recipe;
  const { client } = await requirePublisher();
  const [drafts, recipes, published] = await Promise.all([
    client.from('am_drafts').select('*').order('updated_at', { ascending: false }),
    client.from('recipes').select('id,title,household_id').is('archived_at', null).order('title'),
    client.from('am_recipes').select('id,visible,published_revision'),
  ]);
  if (drafts.error || recipes.error || published.error)
    throw new Error('Administrationen kunne ikke hente data.');
  return (
    <section className="section">
      <span className="eyebrow">AKSELSMAD · REDAKTION</span>
      <h1>Fra opskrift til udgivelse.</h1>
      <p className="lede">
        Vælg fra Vores Kok, gør opskriften klar og godkend den offentlige udgave.
      </p>
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
      <h2>Dine kladder og udgivelser</h2>
      {!drafts.data.length ? (
        <div className="empty">Ingen kladder endnu. Vælg en opskrift ovenfor.</div>
      ) : (
        <div className="draft-list">
          {(drafts.data as Draft[]).map((d) => {
            const p = published.data.find((p) => p.id === d.id);
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
