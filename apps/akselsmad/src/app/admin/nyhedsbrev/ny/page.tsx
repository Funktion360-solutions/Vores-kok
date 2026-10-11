import type { Metadata } from 'next';
import { requirePublisher } from '@/lib/data';
import { newsletterItems } from '@/lib/newsletter-data';
import { newsletterConfigured } from '@/lib/newsletter-resend';
import { NewsletterEditor } from '@/components/newsletter-editor';
export const metadata: Metadata = {
  title: 'Nyt nyhedsbrev',
  robots: { index: false, follow: false },
};
export default async function Page() {
  const { user } = await requirePublisher();
  return (
    <NewsletterEditor
      initial={null}
      items={await newsletterItems()}
      email={user.email || ''}
      configured={newsletterConfigured()}
    />
  );
}
