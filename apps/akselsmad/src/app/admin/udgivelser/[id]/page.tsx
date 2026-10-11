import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requirePublisher } from '@/lib/data';
import { uuid } from '@/lib/personal';
import type { EditionDraft, Edition } from '@/lib/editions';
import { editionOptions } from '@/lib/editions-data';
import { EditionEditor } from '@/components/edition-editor';
export const metadata: Metadata = {
  title: 'Redigér udgivelse',
  robots: { index: false, follow: false },
};
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuid(id)) notFound();
  const { client, user } = await requirePublisher();
  const [draft, publication, options] = await Promise.all([
    client.from('am_edition_drafts').select('*').eq('id', id).eq('owner_id', user.id).maybeSingle(),
    client.from('am_editions').select('*').eq('id', id).maybeSingle(),
    editionOptions(),
  ]);
  if (draft.error || publication.error) throw new Error('Kladden kunne ikke hentes.');
  if (!draft.data) notFound();
  const initial = draft.data as EditionDraft;
  return (
    <EditionEditor
      key={
        initial.revision +
        ':' +
        (publication.data?.visible || false) +
        ':' +
        (publication.data?.published_revision || 0)
      }
      initial={initial}
      published={publication.data as Edition | null}
      kind={initial.kind}
      seed={initial.content}
      options={options}
    />
  );
}
