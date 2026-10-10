import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getDraft, requirePublisher } from '@/lib/data';
import { Editor } from '@/components/editor';
export const metadata: Metadata = {
  title: 'Rediger kladde',
  robots: { index: false, follow: false },
};
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { client } = await requirePublisher();
  const draft = id === 'ny' ? null : await getDraft(id);
  if (id !== 'ny' && !draft) notFound();
  const pub = draft
    ? await client
        .from('am_recipes')
        .select('visible,published_revision')
        .eq('id', id)
        .maybeSingle()
    : { data: null };
  return (
    <Editor
      key={draft?.id + '-' + draft?.revision}
      initial={draft}
      published={pub.data?.visible ?? false}
    />
  );
}
