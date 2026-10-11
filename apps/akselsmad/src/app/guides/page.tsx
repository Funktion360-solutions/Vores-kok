import type { Metadata } from 'next';
import { ArticleIndex } from '@/components/article-index';
export const metadata: Metadata = { title: 'Guides', alternates: { canonical: '/guides' } };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; kategori?: string }>;
}) {
  const p = await searchParams;
  return (
    <ArticleIndex
      kind="guide"
      q={typeof p.q === 'string' ? p.q : ''}
      category={typeof p.kategori === 'string' ? p.kategori : ''}
    />
  );
}
