import 'server-only';
import { cache } from 'react';
import { db } from './supabase';
import type { Edition, EditionKind, EditionOption, EditionItem } from './editions';
import type { PublicRecipe } from './model';
import type { Article } from './editorial';
export const editions = cache(async (kind: EditionKind) => {
  const client = await db();
  const rows: Edition[] = [];
  for (let start = 0; ; start += 200) {
    const result = await client
      .from('am_editions')
      .select('*')
      .eq('kind', kind)
      .eq('visible', true)
      .order('published_at', { ascending: false })
      .order('id')
      .range(start, start + 199);
    if (result.error) throw new Error('Udgivelserne kunne ikke hentes.');
    rows.push(...(result.data as Edition[]));
    if (result.data.length < 200) break;
  }
  return rows;
});
export const publicEdition = cache(async (kind: EditionKind, slug: string) => {
  const client = await db();
  const { data, error } = await client
    .from('am_editions')
    .select('*')
    .eq('kind', kind)
    .eq('slug', slug)
    .eq('visible', true)
    .maybeSingle();
  if (error) throw new Error('Udgivelsen kunne ikke hentes.');
  return data as Edition | null;
});
export async function editionOptions(refs?: EditionItem[]): Promise<EditionOption[]> {
  const client = await db();
  const query = async (table: 'am_recipes' | 'am_articles') => {
    const ids = refs
      ? [
          ...new Set(
            refs
              .filter((i) => (table === 'am_recipes' ? i.type === 'recipe' : i.type !== 'recipe'))
              .map((i) => i.id),
          ),
        ]
      : null;
    if (ids && !ids.length) return [];
    const rows: (PublicRecipe | Article)[] = [];
    for (let start = 0; ; start += 200) {
      let q = client
        .from(table)
        .select('*')
        .eq('visible', true)
        .order('id')
        .range(start, start + 199);
      if (table === 'am_articles') q = q.lte('published_at', new Date().toISOString());
      if (ids) q = q.in('id', ids);
      const result = await q;
      if (result.error) throw new Error('Opskrifter og guides kunne ikke hentes.');
      rows.push(...(result.data as (PublicRecipe | Article)[]));
      if (result.data.length < 200) break;
    }
    return rows;
  };
  const [recipes, articles] = await Promise.all([query('am_recipes'), query('am_articles')]);
  return [
    ...recipes.map((r) => ({
      type: 'recipe' as const,
      id: r.id,
      title: r.content.title,
      category: r.content.category,
      href: '/opskrifter/' + r.slug,
    })),
    ...articles.map((row) => {
      const a = row as Article;
      return {
        type: a.kind,
        id: a.id,
        title: a.content.title,
        category: a.content.category,
        href: '/' + (a.kind === 'guide' ? 'guides' : 'blog') + '/' + a.slug,
      };
    }),
  ].sort((a, b) => a.title.localeCompare(b.title, 'da'));
}
