import 'server-only';
import { db } from './supabase';
import type { NewsletterItem } from './newsletter';
export async function newsletterItems(): Promise<NewsletterItem[]> {
  const client = await db();
  const [recipes, articles] = await Promise.all([
    client
      .from('am_recipes')
      .select('id,slug,content')
      .eq('visible', true)
      .order('published_at', { ascending: false }),
    client
      .from('am_articles')
      .select('id,slug,kind,content')
      .eq('visible', true)
      .lte('published_at', new Date().toISOString())
      .order('published_at', { ascending: false }),
  ]);
  if (recipes.error || articles.error) throw Error('De offentlige indslag kunne ikke hentes.');
  return [
    ...(recipes.data ?? []).map((r) => ({
      id: r.id,
      kind: 'recipe' as const,
      title: r.content.title,
      excerpt: r.content.description || '',
      href: '/opskrifter/' + r.slug,
    })),
    ...(articles.data ?? []).map((a) => ({
      id: a.id,
      kind: a.kind as 'guide' | 'blog',
      title: a.content.title,
      excerpt: a.content.excerpt || '',
      href: '/' + (a.kind === 'guide' ? 'guides' : 'blog') + '/' + a.slug,
    })),
  ];
}
