import { NextResponse } from 'next/server';
import { db } from './supabase';
export function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  return origin === new URL(request.url).origin;
}
export async function publisherApi() {
  const client = await db();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return null;
  const { data, error } = await client
    .from('am_publishers')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();
  return !error && data ? { client, user } : null;
}
export function failure(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
export function errorMessage(error: { code?: string }) {
  return error.code === 'VK409'
    ? 'Kladden er ændret i et andet vindue. Genindlæs siden, før du gemmer.'
    : error.code === '23505'
      ? 'Denne adresse er allerede brugt. Vælg en anden.'
      : error.code === '42501'
        ? 'Du har ikke adgang til denne handling.'
        : 'Kontrollér titel, ingredienser, trin og øvrige felter. Ændringen blev ikke gennemført.';
}
