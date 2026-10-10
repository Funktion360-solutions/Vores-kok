import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin)
    return NextResponse.json({ error: 'Ugyldig forespørgsel.' }, { status: 403 });
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Log ind først.' }, { status: 401 });
  try {
    const b = await request.json();
    if (
      !b ||
      typeof b.id !== 'string' ||
      !uuid.test(b.id) ||
      !Number.isInteger(b.public_revision) ||
      b.public_revision < 1 ||
      !Number.isInteger(b.private_version) ||
      b.private_version < 1 ||
      b.confirm !== true ||
      typeof b.new_copy !== 'boolean'
    )
      return NextResponse.json(
        { error: 'Kontrollér godkendelsen og genindlæs opskriften.' },
        { status: 400 },
      );
    const { data, error } = await (client as unknown as SupabaseClient).rpc(
      'am_refresh_kitchen_copy',
      {
        p_recipe_id: b.id,
        p_expected_public_revision: b.public_revision,
        p_expected_private_version: b.private_version,
        p_confirm: b.confirm,
        p_new_copy: b.new_copy,
      },
    );
    if (error)
      return NextResponse.json(
        {
          error:
            error.code === 'VK409'
              ? 'Opskriften er ændret i et andet vindue. Genindlæs siden før godkendelse.'
              : error.code === 'VK412'
                ? 'Familiens kopi har ændringer. Genindlæs siden og gem den nye udgave som en ekstra opskrift.'
                : 'Opdateringen er ikke tilgængelig, eller du har ikke redigeringsadgang.',
        },
        { status: error.code === 'VK409' || error.code === 'VK412' ? 409 : 400 },
      );
    return NextResponse.json({ id: data });
  } catch {
    return NextResponse.json({ error: 'Forespørgslen kunne ikke behandles.' }, { status: 400 });
  }
}
