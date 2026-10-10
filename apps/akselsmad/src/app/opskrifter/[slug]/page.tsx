import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { db } from '@/lib/supabase';
import { photoUrl } from '@/lib/data';
import type { PublicRecipe } from '@/lib/model';
import { RecipeBody } from '@/components/recipe-body';
import { RecipePersonal } from '@/components/recipe-personal';
import { DownloadPdf } from '@/components/download-pdf';
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
  const [favorites, collections, items, copies, pdfs] = user
    ? await Promise.all([
        client
          .from('am_favorites')
          .select('recipe_id')
          .eq('user_id', user.id)
          .eq('recipe_id', r.id),
        client.from('am_collections').select('id,name').eq('user_id', user.id).order('created_at'),
        client
          .from('am_collection_items')
          .select('collection_id')
          .eq('user_id', user.id)
          .eq('recipe_id', r.id),
        client
          .from('am_kitchen_links')
          .select('recipe_id,household_id,public_revision,created_at,recipes!inner(archived_at)')
          .is('recipes.archived_at', null)
          .eq('public_recipe_id', r.id)
          .order('public_revision', { ascending: false })
          .order('created_at', { ascending: false }),
        client.from('am_pdf_downloads').select('recipe_id').eq('user_id', user.id),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
      ];
  if (favorites.error || collections.error || items.error || copies.error || pdfs.error)
    throw new Error('Dine favoritter og samlinger kunne ikke hentes.');
  return (
    <>
      <RecipeBody recipe={r.content} image={await photoUrl(r.content.cover_path)} />
      <RecipePersonal
        key={r.id}
        id={r.id}
        slug={r.slug}
        signedIn={!!user}
        favorite={!!favorites.data?.length}
        collections={collections.data || []}
        memberships={(items.data || []).map((item) => item.collection_id)}
      />
      <DownloadPdf
        key={r.id + ':' + (pdfs.data || []).length}
        id={r.id}
        slug={r.slug}
        signedIn={!!user}
        used={(pdfs.data || []).length}
        downloaded={(pdfs.data || []).some((row) => row.recipe_id === r.id)}
      />
      <section className="section integration-panel">
        <span className="eyebrow">FRA MIT KØKKEN TIL DIT</span>
        <h2>Tag opskriften med i Vores Kok.</h2>
        <p>Gem din egen kopi i familiens kogebog. Du kan tilpasse den bagefter.</p>
        <CopyToKitchen
          key={r.id + ':' + r.published_revision}
          id={r.id}
          slug={r.slug}
          households={(households.data || []).filter((h: { role: string }) => h.role !== 'viewer')}
          signedIn={!!user}
          copies={copies.data || []}
          publicRevision={r.published_revision}
        />
      </section>
    </>
  );
}
