import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { failure, sameOrigin } from '@/lib/api';
import { uuid } from '@/lib/personal';
export async function POST(request: Request) {
  if (!sameOrigin(request)) return failure('Ugyldig forespørgsel.', 403);
  const client = await db();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return failure('Log ind først.', 401);
  try {
    const b = await request.json();
    if (!b || typeof b !== 'object') return failure('Ugyldige felter.');
    let error;
    if (b.action === 'favorite' || b.action === 'item') {
      if (!uuid(b.recipe_id) || typeof b.saved !== 'boolean') return failure('Vælg en opskrift.');
      const item = b.action === 'item';
      if (item && !uuid(b.collection_id)) return failure('Vælg en samling.');
      const row = {
        user_id: user.id,
        recipe_id: b.recipe_id,
        ...(item ? { collection_id: b.collection_id } : {}),
      };
      const table = item ? 'am_collection_items' : 'am_favorites';
      if (b.saved) {
        const result = await client
          .from(table)
          .upsert(row, {
            onConflict: item ? 'collection_id,recipe_id' : 'user_id,recipe_id',
            ignoreDuplicates: true,
          });
        error = result.error;
      } else {
        let query = client.from(table).delete().eq('user_id', user.id).eq('recipe_id', b.recipe_id);
        if (item) query = query.eq('collection_id', b.collection_id);
        error = (await query).error;
      }
    } else if (b.action === 'create' || b.action === 'rename') {
      if (typeof b.name !== 'string' || !b.name.trim() || b.name.trim().length > 80)
        return failure('Navnet skal være mellem 1 og 80 tegn.');
      if (b.action === 'create') {
        error = (
          await client.from('am_collections').insert({ user_id: user.id, name: b.name.trim() })
        ).error;
      } else {
        if (!uuid(b.id)) return failure('Vælg en samling.');
        const result = await client
          .from('am_collections')
          .update({ name: b.name.trim() })
          .eq('id', b.id)
          .eq('user_id', user.id)
          .select('id');
        error = result.error;
        if (!error && !result.data?.length) return failure('Samlingen findes ikke.', 404);
      }
    } else if (b.action === 'delete') {
      if (!uuid(b.id)) return failure('Vælg en samling.');
      const result = await client
        .from('am_collections')
        .delete()
        .eq('id', b.id)
        .eq('user_id', user.id)
        .select('id');
      error = result.error;
      if (!error && !result.data?.length) return failure('Samlingen findes ikke.', 404);
    } else return failure('Ukendt handling.');
    if (error)
      return failure(
        'Ændringen kunne ikke gemmes. Opskriften eller samlingen er måske ikke længere tilgængelig.',
      );
    return NextResponse.json({ ok: true });
  } catch {
    return failure('Forespørgslen kunne ikke behandles.');
  }
}
