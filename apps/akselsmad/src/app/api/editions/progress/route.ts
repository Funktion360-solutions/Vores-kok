import { NextResponse } from 'next/server';
import { sameOrigin, failure } from '@/lib/api';
import { db } from '@/lib/supabase';
import { uuid } from '@/lib/personal';
export async function POST(request: Request) {
  if (!sameOrigin(request)) return failure('Ugyldig forespørgsel.', 403);
  const client = await db();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return failure('Log ind for at gemme din fremgang.', 401);
  try {
    const raw = await request.text();
    if (raw.length > 2000) return failure('Ugyldig forespørgsel.', 413);
    const b = JSON.parse(raw);
    if (!b || !uuid(b.id) || !uuid(b.chapter) || typeof b.completed !== 'boolean')
      return failure('Ugyldigt trin.');
    const result = b.completed
      ? await client
          .from('am_course_progress')
          .upsert(
            { user_id: user.id, edition_id: b.id, chapter_key: b.chapter },
            { onConflict: 'user_id,edition_id,chapter_key', ignoreDuplicates: true },
          )
      : await client
          .from('am_course_progress')
          .delete()
          .eq('user_id', user.id)
          .eq('edition_id', b.id)
          .eq('chapter_key', b.chapter);
    if (result.error)
      return failure('Din fremgang kunne ikke gemmes. Forløbet kan være ændret.', 400);
    return NextResponse.json({ completed: b.completed });
  } catch {
    return failure('Din fremgang kunne ikke gemmes.');
  }
}
