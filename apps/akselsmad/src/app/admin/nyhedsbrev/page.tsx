import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePublisher } from '@/lib/data';
import { newsletterConfigured } from '@/lib/newsletter-resend';
import { newsletterStatus, type NewsletterCampaign } from '@/lib/newsletter';
import { NewsletterAudience } from '@/components/newsletter-audience';
export const metadata: Metadata = {
  title: 'Nyhedsbreve · Redaktion',
  robots: { index: false, follow: false },
};
export default async function Page() {
  const { client } = await requirePublisher();
  const { data, error } = await client
    .from('am_newsletter_campaigns')
    .select('id,content,revision,status,updated_at')
    .order('updated_at', { ascending: false });
  if (error)
    throw Error(
      'Nyhedsbrevene kunne ikke hentes. Kontrollér at nyhedsbrevsopdateringen er installeret.',
    );
  return (
    <section className="section">
      <Link href="/admin">← Redaktionen</Link>
      <span className="eyebrow">AKSELSMAD · NYHEDSBREVE</span>
      <h1>Et brev, der giver lyst til at lave mad.</h1>
      <p className="lede">
        Saml dine opskrifter, guides og fortællinger. Skriv, test og godkend hvert brev, før det
        sendes.
      </p>
      <div className="actions">
        <Link className="button" href="/admin/nyhedsbrev/ny">
          Skriv et nyt nyhedsbrev →
        </Link>
        <Link className="button secondary" href="/nyhedsbrev">
          Se læsernes tilmeldingsside ↗
        </Link>
      </div>
      <h2>Dine breve</h2>
      <div className="draft-list">
        {data.length ? (
          data.map(
            (
              c: Pick<NewsletterCampaign, 'id' | 'content' | 'revision' | 'status' | 'updated_at'>,
            ) => (
              <Link key={c.id} href={'/admin/nyhedsbrev/' + c.id}>
                <div>
                  <h3>{c.content.subject}</h3>
                  <p>
                    Version {c.revision} · {new Date(c.updated_at).toLocaleDateString('da-DK')}
                  </p>
                </div>
                <span className="status">{newsletterStatus[c.status]} ↗</span>
              </Link>
            ),
          )
        ) : (
          <p>Dit første nyhedsbrev begynder med en kladde.</p>
        )}
      </div>
      <NewsletterAudience configured={newsletterConfigured()} />
    </section>
  );
}
