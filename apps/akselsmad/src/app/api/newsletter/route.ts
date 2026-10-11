import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { sameOrigin, failure } from '@/lib/api';
import {
  changeSubscription,
  newsletterConfigured,
  subscriptionState,
  NewsletterProviderError,
} from '@/lib/newsletter-resend';
export const runtime = 'nodejs';
export async function GET() {
  const client = await db();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user?.email || !user.email_confirmed_at)
    return failure('Log ind med en bekræftet e-mail.', 401);
  try {
    return NextResponse.json(await subscriptionState(user.email), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    return failure(e instanceof Error ? e.message : 'Status kunne ikke hentes.', 503);
  }
}
export async function POST(request: Request) {
  if (!sameOrigin(request)) return failure('Ugyldig forespørgsel.', 403);
  const client = await db();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user?.email || !user.email_confirmed_at)
    return failure('Log ind med en bekræftet e-mail.', 401);
  if (!newsletterConfigured()) return failure('Nyhedsbrevet er ikke sat op endnu.', 503);
  let input;
  try {
    input = await request.json();
  } catch {
    return failure('Ugyldig forespørgsel.');
  }
  if (typeof input?.subscribe !== 'boolean' || (input.subscribe && input.confirm !== true))
    return failure('Markér dit samtykke for at tilmelde dig.');
  const { data, error } = await client.rpc('am_newsletter_preference', {
    p_subscribed: input.subscribe,
    p_confirm: input.confirm === true,
  });
  if (error) return failure('En ændring er allerede i gang. Vent lidt og opdatér status.', 409);
  try {
    await changeSubscription(user.email, input.subscribe);
    const finished = await client.rpc('am_newsletter_preference_finish', {
      p_operation: data.operation_id,
      p_synced: true,
    });
    if (finished.error)
      throw Error('Tilmeldingen er ændret i Resend. Opdatér status for at kontrollere resultatet.');
    return NextResponse.json({ subscribed: input.subscribe, globallyUnsubscribed: false });
  } catch (e) {
    await client.rpc('am_newsletter_preference_finish', {
      p_operation: data.operation_id,
      p_synced: false,
    });
    return failure(
      e instanceof Error ? e.message : 'Ændringen kunne ikke gennemføres.',
      e instanceof NewsletterProviderError && e.status === 409 ? 409 : 503,
    );
  }
}
