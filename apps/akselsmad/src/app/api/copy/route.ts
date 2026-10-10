import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
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
    const { data, error } = await client.rpc('am_copy_to_kitchen', {
      p_id: body.id,
      p_household_id: body.household_id,
    });
    if (error) return failure('Opskriften kunne ikke gemmes i den valgte familie.');
    const origin = process.env.NEXT_PUBLIC_VORES_KOK_URL || 'https://voreskok.funktion360.dk';
    return NextResponse.json({ url: new URL('/recipes/' + data, origin).href });
  } catch {
    return failure('Forespørgslen kunne ikke behandles.');
  }
}
