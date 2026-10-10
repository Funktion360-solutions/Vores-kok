import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { db } from '@/lib/supabase';
import { uuid, type Collection } from '@/lib/personal';
import type { PublicRecipe } from '@/lib/model';
import { RecipeCard } from '@/components/recipe-card';
import { CollectionManager, RemoveSaved } from '@/components/collection-manager';
export const metadata: Metadata = {
  title: 'Mine favoritter og samlinger',
  robots: { index: false, follow: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ samling?: string }>;
}) {
  const client = await db();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) redirect('/login?next=/konto/kogebog');
  const id = (await searchParams).samling;
  if (id && !uuid(id)) notFound();
  const collectionsResult = await client
    .from('am_collections')
    .select('id,name')
    .eq('user_id', user.id)
    .order('created_at');
  if (collectionsResult.error) throw new Error('Samlingerne kunne ikke hentes.');
  const collections = collectionsResult.data as Collection[];
  const selected = collections.find((c) => c.id === id) || null;
  if (id && !selected) notFound();
  let query = client
    .from(id ? 'am_collection_items' : 'am_favorites')
    .select('recipe_id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  if (id) query = query.eq('collection_id', id);
  const rows = await query;
  if (rows.error) throw new Error('Dine gemte opskrifter kunne ikke hentes.');
  const ids = (rows.data || []).map((row) => row.recipe_id as string);
  const result = ids.length
    ? await client.from('am_recipes').select('*').in('id', ids).eq('visible', true)
    : { data: [], error: null };
  if (result.error) throw new Error('Opskrifterne kunne ikke hentes.');
  const recipes = new Map((result.data as PublicRecipe[]).map((r) => [r.id, r]));
  return (
    <section className="section personal-cookbook">
      <span className="eyebrow">DIT KØKKEN PÅ AKSELSMAD</span>
      <h1>Favoritter og samlinger.</h1>
      <p className="lede">Din inspiration, samlet ét sted. Kun du kan se dine samlinger.</p>
      <Link href="/konto">← Tilbage til din konto</Link>
      <nav className="collection-tabs" aria-label="Dine samlinger">
        <Link
          className={!id ? 'active' : ''}
          aria-current={!id ? 'page' : undefined}
          href="/konto/kogebog"
        >
          ♥ Favoritter
        </Link>
        {collections.map((c) => (
          <Link
            key={c.id}
            className={id === c.id ? 'active' : ''}
            aria-current={id === c.id ? 'page' : undefined}
            href={'/konto/kogebog?samling=' + c.id}
          >
            {c.name}
          </Link>
        ))}
      </nav>
      <CollectionManager key={id || 'favorites'} selected={selected} />
      <h2>{selected?.name || 'Dine favoritter'}</h2>
      {!ids.length ? (
        <div className="empty-cookbook">
          <h3>Her er plads til dine næste favoritter.</h3>
          <p>Åbn en opskrift og gem den som favorit eller føj den til en samling.</p>
          <Link className="button" href="/opskrifter">
            Find opskrifter
          </Link>
        </div>
      ) : (
        <div className="recipe-grid">
          {ids.map((recipeId) => {
            const recipe = recipes.get(recipeId);
            return (
              <div key={recipeId} className="saved-recipe">
                {recipe ? (
                  <RecipeCard recipe={recipe} />
                ) : (
                  <div className="unavailable-recipe">
                    <h3>Opskriften er ikke længere offentlig</h3>
                    <p>Den kan vises igen, hvis Aksel udgiver den på ny.</p>
                  </div>
                )}
                <RemoveSaved recipeId={recipeId} collectionId={id} />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
