import type { Metadata } from 'next';
import { publicRecipes } from '@/lib/data';
import { categories, filterRecipes } from '@/lib/model';
import { RecipeCard } from '@/components/recipe-card';
export const metadata: Metadata = { title: 'Opskrifter' };
export default async function Recipes({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; kategori?: string; tid?: string; svaerhed?: string }>;
}) {
  const s = await searchParams;
  const rows = filterRecipes(
    await publicRecipes(),
    s.q || '',
    s.kategori || '',
    Number(s.tid) || 0,
    s.svaerhed || '',
  );
  return (
    <section className="section">
      <span className="eyebrow">FIND DIN NÆSTE FAVORIT</span>
      <h1>Opskrifter fra mit køkken.</h1>
      <p className="lede">Fra hverdagens aftensmad til dejen, der får lov at tage sin tid.</p>
      <form className="search-form">
        <label>
          Søg på ret eller ingrediens
          <input name="q" defaultValue={s.q} placeholder="Fx pasta, tomat eller surdej" />
        </label>
        <label>
          Kategori
          <select name="kategori" defaultValue={s.kategori || ''}>
            <option value="">Alle kategorier</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Tid
          <select name="tid" defaultValue={s.tid || ''}>
            <option value="">Alle tider</option>
            <option value="30">Højst 30 min</option>
            <option value="60">Højst 1 time</option>
            <option value="120">Højst 2 timer</option>
          </select>
        </label>
        <label>
          Sværhedsgrad
          <select name="svaerhed" defaultValue={s.svaerhed || ''}>
            <option value="">Alle niveauer</option>
            <option value="easy">Let</option>
            <option value="medium">Middel</option>
            <option value="hard">Svær</option>
          </select>
        </label>
        <button>Søg opskrifter</button>
      </form>
      <p>
        {rows.length} opskrift{rows.length !== 1 ? 'er' : ''}
      </p>
      {rows.length ? (
        <div className="recipe-grid">
          {rows.map((r) => (
            <RecipeCard key={r.id} recipe={r} />
          ))}
        </div>
      ) : (
        <div className="empty">
          <h2>Ingen opskrifter her endnu.</h2>
          <p>Prøv en bredere søgning, eller kom tilbage, når de første opskrifter er udgivet.</p>
        </div>
      )}
    </section>
  );
}
