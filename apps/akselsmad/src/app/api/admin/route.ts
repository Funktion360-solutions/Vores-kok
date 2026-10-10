import { NextResponse } from 'next/server';
import { sameOrigin, publisherApi, failure, errorMessage } from '@/lib/api';
export async function POST(request: Request) {
  if (!sameOrigin(request)) return failure('Ugyldig forespørgsel.', 403);
  const s = await publisherApi();
  if (!s) return failure('Log ind med en redaktørkonto.', 403);
  try {
    const body = await request.json();
    let result;
    if (body.action === 'import') {
      result = await s.client.rpc('am_import_recipe', { p_recipe_id: body.id });
    } else if (body.action === 'save') {
      result = await s.client.rpc('am_save_draft', {
        p_id: body.id || null,
        p_slug: body.slug,
        p_content: body.content,
        p_revision: body.revision || 0,
      });
    } else if (body.action === 'publish') {
      result = await s.client.rpc('am_publish', {
        p_id: body.id,
        p_revision: body.revision,
        p_confirm: body.confirm === true,
      });
    } else if (body.action === 'unpublish') {
      result = await s.client
        .from('am_recipes')
        .update({ visible: false })
        .eq('id', body.id)
        .select('id')
        .single();
    } else return failure('Ukendt handling.');
    if (result.error)
      return failure(errorMessage(result.error), result.error.code === 'VK409' ? 409 : 400);
    return NextResponse.json({ id: result.data });
  } catch {
    return failure('Forespørgslen kunne ikke behandles.');
  }
}
