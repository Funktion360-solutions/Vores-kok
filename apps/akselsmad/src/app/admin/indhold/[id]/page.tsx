import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requirePublisher } from '@/lib/data';
import { uuid } from '@/lib/personal';
import { ArticleEditor } from '@/components/article-editor';
import type { Article, ArticleDraft } from '@/lib/editorial';
export const metadata: Metadata = {
  title: 'Redigér indhold',
  robots: { index: false, follow: false },
};
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (id !== 'ny' && !uuid(id)) notFound();
  const { client } = await requirePublisher();
  const [draft, published, recipes] = await Promise.all([
    id === 'ny'
      ? Promise.resolve({ data: null, error: null })
      : client.from('am_article_drafts').select('*').eq('id', id).maybeSingle(),
    id === 'ny'
      ? Promise.resolve({ data: null, error: null })
      : client.from('am_articles').select('*').eq('id', id).maybeSingle(),
    client
      .from('am_recipes')
      .select('id,content')
      .eq('visible', true)
      .order('published_at', { ascending: false }),
  ]);
  if (draft.error || published.error || recipes.error)
    throw new Error('Editoren kunne ikke hente data.');
  if (id !== 'ny' && !draft.data) notFound();
  return (
    <ArticleEditor
      key={id + ':' + (draft.data?.revision || 0)}
      asOf={new Date().getTime()}
      initial={draft.data as ArticleDraft | null}
      published={published.data as Article | null}
      recipes={(recipes.data || []).map((r) => ({ id: r.id, title: r.content.title }))}
    />
  );
}
