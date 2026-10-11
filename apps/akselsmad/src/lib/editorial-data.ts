import 'server-only';
import { cache } from 'react';
import { db } from './supabase';
import type { Article } from './editorial';
export const articles = cache(async (kind?: 'guide' | 'blog') => {
  const client = await db();
  let query = client
    .from('am_articles')
    .select('*')
    .eq('visible', true)
    .lte('published_at', new Date().toISOString())
    .order('published_at', { ascending: false });
  if (kind) query = query.eq('kind', kind);
  const { data, error } = await query;
  if (error) throw new Error('Artiklerne kunne ikke hentes.');
  return data as Article[];
});
export const editorialPhoto = cache(async (path: string) => {
  if (!path) return null;
  const client = await db();
  const { data } = await client.storage.from('akselsmad-editorial').createSignedUrl(path, 300);
  return data?.signedUrl ?? null;
});
