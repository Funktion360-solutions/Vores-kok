import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePublisher } from '@/lib/data';
import { newsletterItems } from '@/lib/newsletter-data';
import { newsletterConfigured } from '@/lib/newsletter-resend';
import { newsletterUuid, type NewsletterCampaign } from '@/lib/newsletter';
import {
  newsletterTemplate,
  newsletterTemplates,
  copyNewsletterDraft,
} from '@/lib/newsletter-workspace';
import { NewsletterEditor } from '@/components/newsletter-editor';
export const metadata: Metadata = {
  title: 'Nyt nyhedsbrev',
  robots: { index: false, follow: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ copy?: string; template?: string }>;
}) {
  const { copy, template } = await searchParams;
  const { client, user } = await requirePublisher();
  const itemsPromise = newsletterItems();
  const source = copy
    ? client
        .from('am_newsletter_campaigns')
        .select('content,status')
        .eq('id', newsletterUuid(copy) ? copy : '00000000-0000-0000-0000-000000000000')
        .eq('owner_id', user.id)
        .single()
    : Promise.resolve(null);
  const [items, result] = await Promise.all([itemsPromise, source]);
  let seed = newsletterTemplate(template);
  let note = '';
  if (copy) {
    if (!newsletterUuid(copy) || !result?.data || result.error) notFound();
    const c = result.data as Pick<NewsletterCampaign, 'content' | 'status'>;
    if (c.status !== 'draft' && c.status !== 'sent')
      return (
        <section className="section reading">
          <h1>Afklar først det eksisterende brev.</h1>
          <p>
            Brevet er allerede ved at blive klargjort eller udsendt. Opdatér status på det
            eksisterende brev, før du genbruger indholdet.
          </p>
          <Link className="button" href={'/admin/nyhedsbrev/' + copy}>
            Tilbage til brevet →
          </Link>
        </section>
      );
    const copied = copyNewsletterDraft(c, items);
    seed = copied.content;
    note =
      'Indholdet er kopieret til et nyt brev. Tilpas det og gem som ny kladde.' +
      (copied.removed
        ? ' ' + copied.removed + ' indslag er udeladt, fordi de ikke længere er offentlige.'
        : '');
  } else {
    const selected = newsletterTemplates.find((t) => t.id === template);
    note = selected ? 'Skabelon: ' + selected.label + '. Tilpas teksten og vælg dine indslag.' : '';
  }
  return (
    <NewsletterEditor
      key={copy || template || 'new'}
      initial={null}
      seed={seed}
      note={note}
      items={items}
      email={user.email || ''}
      configured={newsletterConfigured()}
    />
  );
}
