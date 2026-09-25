/**
 * Client-side filtering of cached recipe documents (mobile offline mode).
 * Mirrors the semantics of public.search_recipes closely enough for offline
 * use: case-insensitive substring matching on title/description/ingredients/
 * origin, AND semantics for ingredients and tags.
 */
import { normalizeIngredientName, totalMinutes } from '@vores-kok/domain';
import type { RecipeDocument, RecipeFilters } from '@vores-kok/validation';
import type { RecipeSummary } from './queries';

const norm = (s: string | null | undefined) => (s ?? '').toLocaleLowerCase('da').normalize('NFC');

export function hasFamilyHistory(d: RecipeDocument): boolean {
  return Boolean(d.origin_person_id || d.origin_text || d.stories.length || d.media.some((m) => m.kind === 'original_scan' || m.kind === 'historical_photo'));
}

function score(d: RecipeDocument, q: string): number {
  const title = norm(d.title);
  if (title === q) return 100;
  if (title.startsWith(q)) return 50;
  if (title.includes(q)) return 30;
  if (d.ingredients.some((i) => normalizeIngredientName(i.name).includes(q))) return 15;
  if (norm(d.origin_text).includes(q) || norm(d.origin_person?.name).includes(q) || norm(d.legacy_author).includes(q)) return 12;
  if (norm(d.description).includes(q) || norm(d.category?.name).includes(q) || d.tags.some((t) => norm(t.name).includes(q))) return 10;
  if (norm(d.notes).includes(q) || d.steps.some((s) => norm(s.body).includes(q)) || d.stories.some((s) => norm(s.body).includes(q))) return 5;
  return 0;
}

export function filterRecipeDocuments(docs: RecipeDocument[], f: RecipeFilters = {}): RecipeDocument[] {
  const q = norm(f.q).trim();
  const wanted = (f.ingredients ?? []).map(normalizeIngredientName).filter(Boolean);
  const out: Array<{ d: RecipeDocument; s: number }> = [];
  for (const d of docs) {
    if (!f.archived && d.archived_at) continue;
    if (f.category?.length && !(d.category_id && f.category.includes(d.category_id))) continue;
    if (f.difficulty?.length && !(d.difficulty && f.difficulty.includes(d.difficulty))) continue;
    if (f.meal?.length && !d.meal_types.some((m) => (f.meal as string[]).includes(m))) continue;
    if (f.tag?.length && !f.tag.every((t) => d.tags.some((x) => x.id === t))) continue;
    if (f.favorites && !d.is_favorite) continue;
    if (f.family && !hasFamilyHistory(d)) continue;
    if (f.person && d.origin_person_id !== f.person && !d.stories.some((s) => s.person_id === f.person)) continue;
    if (f.maxTime && (totalMinutes(d) ?? 0) > f.maxTime) continue;
    if (f.maxPrep && (d.prep_minutes ?? 0) > f.maxPrep) continue;
    if (wanted.length && !wanted.every((w) => d.ingredients.some((i) => normalizeIngredientName(i.name).includes(w)))) continue;
    const s = q ? score(d, q) : 0;
    if (q && s === 0) continue;
    out.push({ d, s });
  }
  const sort = f.sort ?? (q ? 'relevance' : 'title');
  out.sort((a, b) => {
    if (sort === 'relevance' && b.s !== a.s) return b.s - a.s;
    if (sort === 'updated') return b.d.updated_at.localeCompare(a.d.updated_at);
    if (sort === 'time') return (totalMinutes(a.d) ?? 1e9) - (totalMinutes(b.d) ?? 1e9);
    return a.d.title.localeCompare(b.d.title, 'da');
  });
  return out.map((x) => x.d);
}

/** Converts a cached document into the list-row shape shared with the web app. */
export function documentToSummary(d: RecipeDocument): RecipeSummary {
  const cover = d.media.find((m) => m.is_cover && m.mime_type.startsWith('image/')) ?? d.media.find((m) => m.kind === 'photo' && m.mime_type.startsWith('image/'));
  return {
    id: d.id, household_id: d.household_id, title: d.title, description: d.description, category_id: d.category_id,
    category_name: d.category?.name ?? null, category_icon: d.category?.icon ?? null, difficulty: d.difficulty,
    servings: d.servings, yield_unit: d.yield_unit, prep_minutes: d.prep_minutes, cook_minutes: d.cook_minutes,
    total_minutes: d.total_minutes, meal_types: d.meal_types, origin_text: d.origin_text,
    origin_person_name: d.origin_person?.name ?? null, legacy_author: d.legacy_author, cover_path: cover?.storage_path ?? null,
    is_favorite: d.is_favorite, has_story: d.stories.length > 0, archived_at: d.archived_at, updated_at: d.updated_at,
  };
}
