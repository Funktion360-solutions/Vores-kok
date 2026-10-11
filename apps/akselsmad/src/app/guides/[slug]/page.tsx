import type { Metadata } from 'next';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import { db } from '@/lib/supabase';
import { ArticleBody } from '@/components/article-body';
import type { Article } from '@/lib/editorial';
const get = cache(async (slug: string) => {
  const client = await db();
  const { data, error } = await client
    .from('am_articles')
    .select('*')
    .eq('kind', 'guide')
    .eq('slug', slug)
    .eq('visible', true)
    .lte('published_at', new Date().toISOString())
    .maybeSingle();
  if (error) throw new Error('Artiklen kunne ikke hentes.');
  return data as Article | null;
});
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const a = await get(slug);
  return {
    title: a?.content.title || 'Guides',
    description: a?.content.excerpt,
    alternates: { canonical: '/guides/' + slug },
  };
}
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const a = await get((await params).slug);
  if (!a) notFound();
  return <ArticleBody content={a.content} kind="guide" publishedAt={a.published_at} />;
}
