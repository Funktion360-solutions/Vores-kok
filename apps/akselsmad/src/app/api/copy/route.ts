import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { uuid } from '@/lib/personal';
import { sameOrigin, failure } from '@/lib/api';
export async function POST(request: Request) {
  if (!sameOrigin(request)) return failure('Ugyldig forespørgsel.', 403);
  const client = await db();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return failure('Log ind først.', 401);
  try {
    const body = await request.json();
    if (!body || !uuid(body.id) || !uuid(body.household_id))
      return failure('Vælg en opskrift og familie.');
    const { data, error } = await client.rpc('am_copy_to_kitchen', {
      p_id: body.id,
      p_household_id: body.household_id,
    });
    if (error) return failure('Opskriften kunne ikke gemmes i den valgte familie.');
    const link = await client
      .from('am_kitchen_links')
      .select('public_revision')
      .eq('recipe_id', data)
      .maybeSingle();
    const origin = process.env.NEXT_PUBLIC_VORES_KOK_URL || 'https://voreskok.funktion360.dk';
    return NextResponse.json({
      url: new URL('/recipes/' + data, origin).href,
      id: data,
      revision: link.data?.public_revision ?? null,
    });
  } catch {
    return failure('Forespørgslen kunne ikke behandles.');
  }
}
