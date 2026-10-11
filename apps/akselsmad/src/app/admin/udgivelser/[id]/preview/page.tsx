import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePublisher } from '@/lib/data';
import { uuid } from '@/lib/personal';
import type { EditionDraft } from '@/lib/editions';
import { EditionBody } from '@/components/edition-body';
export const metadata: Metadata = {
  title: 'Forhåndsvisning',
  robots: { index: false, follow: false },
};
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuid(id)) notFound();
  const { client, user } = await requirePublisher();
  const { data, error } = await client
    .from('am_edition_drafts')
    .select('*')
    .eq('id', id)
    .eq('owner_id', user.id)
    .maybeSingle();
  if (error) throw new Error('Kladden kunne ikke hentes.');
  if (!data) notFound();
  return (
    <>
      <div className="preview-banner">
        FORHÅNDSVISNING · Gemt kladde ·{' '}
        <Link href={'/admin/udgivelser/' + id}>Tilbage til redigering</Link>
      </div>
      <EditionBody edition={data as EditionDraft} preview />
    </>
  );
}
