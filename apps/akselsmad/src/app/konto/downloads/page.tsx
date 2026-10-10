import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db } from '@/lib/supabase';
import { DownloadPdf } from '@/components/download-pdf';
import type { PublicRecipe } from '@/lib/model';
export const metadata: Metadata = {
  title: 'Mine PDF-opskrifter',
  robots: { index: false, follow: false },
};
export default async function Page() {
  const client = await db();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) redirect('/login?next=/konto/downloads');
  const history = await client
    .from('am_pdf_downloads')
    .select('recipe_id,created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  if (history.error) throw new Error('Downloadhistorikken kunne ikke hentes.');
  const rows = history.data || [];
  const result = rows.length
    ? await client
        .from('am_recipes')
        .select('*')
        .in(
          'id',
          rows.map((r) => r.recipe_id),
        )
        .eq('visible', true)
    : { data: [], error: null };
  if (result.error) throw new Error('Opskrifterne kunne ikke hentes.');
  const recipes = new Map((result.data as PublicRecipe[]).map((recipe) => [recipe.id, recipe]));
  return (
    <section className="section reading">
      <span className="eyebrow">DIN OPSKRIFTSSAMLING PÅ PAPIR</span>
      <h1>Mine PDF-opskrifter.</h1>
      <p className="lede">{rows.length} af 5 forskellige opskrifter hentet.</p>
      <p>
        Grænsen gælder samlet for din konto. Gen-download og nyere udgaver af samme opskrift bruger
        ingen ekstra plads.
      </p>
      <Link href="/konto">← Tilbage til din konto</Link>
      {!rows.length ? (
        <p>
          Du har endnu ikke hentet en PDF. <Link href="/opskrifter">Find din første opskrift</Link>.
        </p>
      ) : (
        rows.map((row) => {
          const recipe = recipes.get(row.recipe_id);
          return recipe ? (
            <div key={row.recipe_id} className="pdf-history-item">
              <h2>
                <Link href={'/opskrifter/' + recipe.slug}>{recipe.content.title}</Link>
              </h2>
              <DownloadPdf
                compact
                id={recipe.id}
                slug={recipe.slug}
                signedIn
                used={rows.length}
                downloaded
              />
            </div>
          ) : (
            <div key={row.recipe_id} className="notice">
              <h2>Opskriften er ikke længere offentlig</h2>
              <p>
                Den tæller fortsat som en af dine fem opskrifter. En PDF, du allerede har gemt på
                din enhed, påvirkes ikke.
              </p>
            </div>
          );
        })
      )}
    </section>
  );
}
