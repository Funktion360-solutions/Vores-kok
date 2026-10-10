import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { failure, sameOrigin } from '@/lib/api';
import { uuid } from '@/lib/personal';
import { recipePdf } from '@/lib/recipe-pdf';
import type { PublicRecipe } from '@/lib/model';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  if (!sameOrigin(request)) return failure('Ugyldig forespørgsel.', 403);
  const client = await db();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return failure('Log ind for at hente PDF.', 401);
  try {
    const b = await request.json();
    if (!b || !uuid(b.id)) return failure('Vælg en opskrift.');
    const [recipe, history] = await Promise.all([
      client.from('am_recipes').select('*').eq('id', b.id).eq('visible', true).maybeSingle(),
      client.from('am_pdf_downloads').select('recipe_id').eq('user_id', user.id),
    ]);
    if (recipe.error || history.error)
      return failure('Download kunne ikke forberedes. Prøv igen om lidt.', 503);
    if (!recipe.data) return failure('Opskriften er ikke længere offentlig.', 404);
    const ids = (history.data || []).map((row) => row.recipe_id);
    if (!ids.includes(b.id) && ids.length >= 5)
      return failure(
        'Du har hentet fem forskellige opskrifter. Du kan stadig hente de samme opskrifter igen.',
        429,
      );
    // Generate first. Font or layout errors must not consume a download slot.
    const bytes = await recipePdf(
      recipe.data as PublicRecipe,
      process.env.NEXT_PUBLIC_SITE_URL || 'https://akselsmad.dk',
    );
    const claimed = await client.rpc('am_claim_pdf', {
      p_id: b.id,
      p_expected_revision: recipe.data.published_revision,
    });
    if (claimed.error)
      return failure(
        claimed.error.code === 'VK429'
          ? 'Du har hentet fem forskellige opskrifter. Du kan stadig hente de samme opskrifter igen.'
          : claimed.error.code === 'VK409'
            ? 'Opskriften blev opdateret. Prøv at hente den igen.'
            : 'Opskriften kunne ikke hentes.',
        claimed.error.code === 'VK429' ? 429 : 409,
      );
    return new Response(new Uint8Array(bytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="akselsmad-${recipe.data.slug}.pdf"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'X-PDF-Used': String(claimed.data.used),
      },
    });
  } catch {
    return failure(
      'PDF kunne ikke hentes. Prøv igen; samme opskrift bruger ikke en ekstra plads.',
      500,
    );
  }
}
