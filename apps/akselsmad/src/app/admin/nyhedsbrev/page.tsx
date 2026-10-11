import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePublisher } from '@/lib/data';
import { newsletterConfigured } from '@/lib/newsletter-resend';
import { type NewsletterCampaign } from '@/lib/newsletter';
import { newsletterTemplates } from '@/lib/newsletter-workspace';
import { NewsletterCampaignList } from '@/components/newsletter-campaign-list';
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
      <section className="newsletter-template-section" aria-labelledby="newsletter-templates-title">
        <span className="eyebrow">EN GOD START PÅ DIT NÆSTE BREV</span>
        <h2 id="newsletter-templates-title">Vælg en retning.</h2>
        <p>Skabeloner med tekst, du kan tilpasse. Du vælger selv opskrifter og artikler.</p>
        <div className="newsletter-templates">
          {newsletterTemplates.map((t) => (
            <Link key={t.id} href={'/admin/nyhedsbrev/ny?template=' + t.id}>
              <small>{t.tag}</small>
              <h3>{t.label}</h3>
              <p>{t.description}</p>
              <span>Brug skabelonen →</span>
            </Link>
          ))}
        </div>
      </section>
      <NewsletterCampaignList
        campaigns={(
          data as Pick<
            NewsletterCampaign,
            'id' | 'content' | 'revision' | 'status' | 'updated_at'
          >[]
        ).map((c) => ({
          id: c.id,
          subject: c.content.subject,
          title: c.content.title,
          revision: c.revision,
          status: c.status,
          updated_at: c.updated_at,
        }))}
      />
      <NewsletterAudience configured={newsletterConfigured()} />
    </section>
  );
}
