import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requirePublisher } from '@/lib/data';
import { newsletterUuid, type NewsletterCampaign } from '@/lib/newsletter';
import { newsletterItems } from '@/lib/newsletter-data';
import { newsletterConfigured } from '@/lib/newsletter-resend';
import { NewsletterEditor } from '@/components/newsletter-editor';
export const metadata: Metadata = {
  title: 'Redigér nyhedsbrev',
  robots: { index: false, follow: false },
};
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!newsletterUuid(id)) notFound();
  const { client, user } = await requirePublisher();
  const [campaign, items] = await Promise.all([
    client.from('am_newsletter_campaigns').select('*').eq('id', id).single(),
    newsletterItems(),
  ]);
  if (campaign.error || !campaign.data) notFound();
  const c = campaign.data as NewsletterCampaign;
  return (
    <NewsletterEditor
      key={c.id + ':' + c.revision}
      initial={c}
      items={items}
      email={user.email || ''}
      configured={newsletterConfigured()}
    />
  );
}
