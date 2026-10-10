import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { db } from '@/lib/supabase';
import { photoUrl } from '@/lib/data';
import type { PublicRecipe } from '@/lib/model';
import { RecipeBody } from '@/components/recipe-body';
import { CopyToKitchen } from '@/components/copy-to-kitchen';
async function get(slug: string) {
  const client = await db();
  const { data, error } = await client
    .from('am_recipes')
    .select('*')
    .eq('slug', slug)
    .eq('visible', true)
    .maybeSingle();
  if (error) throw error;
  return data as PublicRecipe | null;
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const r = await get((await params).slug);
  return {
    title: r?.content.title || 'Opskrift',
    description: r?.content.description,
    alternates: { canonical: '/opskrifter/' + (await params).slug },
  };
}
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const r = await get((await params).slug);
  if (!r) notFound();
  const client = await db();
  const {
    data: { user },
  } = await client.auth.getUser();
  const households = user ? await client.rpc('my_households') : { data: [] };
  return (
    <>
      <RecipeBody recipe={r.content} image={await photoUrl(r.content.cover_path)} />
      <section className="section integration-panel">
        <span className="eyebrow">FRA MIT KØKKEN TIL DIT</span>
        <h2>Tag opskriften med i Vores Kok.</h2>
        <p>Gem din egen kopi i familiens kogebog. Du kan tilpasse den bagefter.</p>
        <CopyToKitchen
          id={r.id}
          slug={r.slug}
          households={(households.data || []).filter((h: { role: string }) => h.role !== 'viewer')}
          signedIn={!!user}
        />
      </section>
    </>
  );
}
