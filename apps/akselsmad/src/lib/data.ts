import 'server-only';
import { cache } from 'react';
import { db } from './supabase';
import { redirect } from 'next/navigation';
import type { PublicRecipe, Draft } from './model';
export async function requirePublisher() {
  const client = await db();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) redirect('/login?next=/admin');
  const { data, error } = await client
    .from('am_publishers')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) throw new Error('Adgangen til administrationen kunne ikke kontrolleres.');
  if (!data) redirect('/konto?adgang=nej');
  return { client, user };
}
export async function publicRecipes() {
  const client = await db();
  const { data, error } = await client
    .from('am_recipes')
    .select('*')
    .eq('visible', true)
    .order('published_at', { ascending: false });
  if (error) throw new Error('Opskrifterne kunne ikke hentes. Prøv igen om lidt.');
  return data as PublicRecipe[];
}
export async function getDraft(id: string) {
  const { client } = await requirePublisher();
  const { data, error } = await client.from('am_drafts').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data as Draft | null;
}
export const photoUrl = cache(async (path?: string) => {
  if (!path) return null;
  const client = await db();
  const { data } = await client.storage.from('akselsmad-photos').createSignedUrl(path, 300);
  return data?.signedUrl ?? null;
});
