import type { Metadata } from 'next';
import { EditionIndex } from '@/components/edition-index';
export const metadata: Metadata = { title: 'Temaforløb', alternates: { canonical: '/forloeb' } };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  return <EditionIndex kind="course" params={await searchParams} />;
}
