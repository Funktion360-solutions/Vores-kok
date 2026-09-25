import { DIFFICULTY_LABELS, formatMinutes, totalMinutes } from '@vores-kok/domain';
import type { RecipeSummary } from '@vores-kok/database';
import { Clock, Heart, ScrollText, Star } from 'lucide-react';
import Link from 'next/link';
import { CategoryIcon } from './category-icon';

export function RecipeCard({ recipe, imageUrl }: { recipe: RecipeSummary; imageUrl?: string | undefined }) {
  const time = totalMinutes(recipe);
  const family = recipe.origin_person_name ?? recipe.origin_text;
  return (
    <Link href={`/recipes/${recipe.id}`}
      className="group flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-paper transition-shadow hover:shadow-[0_8px_24px_-12px_rgba(42,33,28,0.25)] focus-visible:shadow-lg">
      <div className="relative aspect-[4/3] overflow-hidden bg-sand">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed private URLs, not optimisable by next/image
          <img src={imageUrl} alt="" loading="lazy" className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
        ) : (
          <div className="flex size-full items-center justify-center bg-gradient-to-br from-brand-soft to-honey-soft text-brand/70">
            <CategoryIcon icon={recipe.category_icon} className="size-12" />
          </div>
        )}
        {recipe.is_favorite ? (
          <span className="absolute right-2.5 top-2.5 rounded-full bg-paper/90 p-1.5 text-honey shadow-sm" title="Favorit">
            <Star className="size-4 fill-current" aria-label="Favorit" />
          </span>
        ) : null}
        {recipe.archived_at ? <span className="absolute left-2.5 top-2.5 rounded-full bg-ink/80 px-2 py-0.5 text-xs text-white">Arkiveret</span> : null}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        {recipe.category_name ? <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">{recipe.category_name}</span> : null}
        <h3 className="font-display text-lg font-semibold leading-snug text-ink group-hover:text-brand-dark">{recipe.title}</h3>
        {family ? (
          <p className="flex items-center gap-1.5 text-sm text-sage"><Heart className="size-3.5" aria-hidden /> {family}</p>
        ) : null}
        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 text-sm text-ink-muted">
          {time ? <span className="flex items-center gap-1"><Clock className="size-3.5" aria-hidden />{formatMinutes(time)}</span> : null}
          {recipe.difficulty ? <span>{DIFFICULTY_LABELS[recipe.difficulty]}</span> : null}
          {recipe.has_story ? <span className="flex items-center gap-1" title="Har en historie"><ScrollText className="size-3.5" aria-hidden />Historie</span> : null}
        </div>
      </div>
    </Link>
  );
}

export function RecipeGrid({ recipes, urls }: { recipes: RecipeSummary[]; urls: Record<string, string> }) {
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {recipes.map((r) => (
        <li key={r.id}><RecipeCard recipe={r} imageUrl={r.cover_path ? urls[r.cover_path] : undefined} /></li>
      ))}
    </ul>
  );
}
