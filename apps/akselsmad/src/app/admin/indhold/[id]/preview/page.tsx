import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requirePublisher } from '@/lib/data';
import { uuid } from '@/lib/personal';
import { ArticleBody } from '@/components/article-body';
import type { ArticleDraft } from '@/lib/editorial';
export const metadata: Metadata = {
  title: 'Forhåndsvisning',
  robots: { index: false, follow: false },
};
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuid(id)) notFound();
  const { client } = await requirePublisher();
  const { data, error } = await client
    .from('am_article_drafts')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error('Kladden kunne ikke hentes.');
  if (!data) notFound();
  const draft = data as ArticleDraft;
  return (
    <>
      <div className="preview-banner">
        FORHÅNDSVISNING · Ikke en offentlig udgivelse ·{' '}
        <Link href={'/admin/indhold/' + id}>Tilbage til editor</Link>
      </div>
      <ArticleBody content={draft.content} kind={draft.kind} />
    </>
  );
}
