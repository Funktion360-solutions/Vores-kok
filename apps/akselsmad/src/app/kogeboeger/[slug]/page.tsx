import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { publicEdition } from '@/lib/editions-data';
import { EditionBody } from '@/components/edition-body';
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const e = await publicEdition('book', slug);
  return e
    ? {
        title: e.content.title,
        description: e.content.excerpt,
        alternates: { canonical: '/kogeboeger/' + e.slug },
      }
    : { title: 'Ikke fundet', robots: { index: false } };
}
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const e = await publicEdition('book', slug);
  if (!e) notFound();
  return <EditionBody edition={e} />;
}
