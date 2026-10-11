import type { Metadata } from 'next';
import { ArticleIndex } from '@/components/article-index';
export const metadata: Metadata = { title: 'Fra mit køkken', alternates: { canonical: '/blog' } };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; kategori?: string }>;
}) {
  const p = await searchParams;
  return (
    <ArticleIndex
      kind="blog"
      q={typeof p.q === 'string' ? p.q : ''}
      category={typeof p.kategori === 'string' ? p.kategori : ''}
    />
  );
}
