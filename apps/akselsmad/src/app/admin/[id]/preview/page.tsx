import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getDraft, photoUrl } from '@/lib/data';
import { RecipeBody } from '@/components/recipe-body';
export const metadata: Metadata = {
  title: 'Forhåndsvisning',
  robots: { index: false, follow: false },
};
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const draft = await getDraft(id);
  if (!draft) notFound();
  return (
    <>
      <div className="section preview-nav">
        <Link href={'/admin/' + id}>← Tilbage til redigering og udgivelse</Link>
      </div>
      <RecipeBody recipe={draft.content} image={await photoUrl(draft.content.cover_path)} preview />
    </>
  );
}
