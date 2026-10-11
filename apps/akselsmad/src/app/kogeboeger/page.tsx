import type { Metadata } from 'next';
import { EditionIndex } from '@/components/edition-index';
export const metadata: Metadata = { title: 'Kogebøger', alternates: { canonical: '/kogeboeger' } };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  return <EditionIndex kind="book" params={await searchParams} />;
}
