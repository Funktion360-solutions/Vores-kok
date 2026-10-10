import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
export async function AkselsMadExport({ recipeId }: { recipeId: string }) {
  const origin = process.env.AKSELSMAD_ADMIN_URL;
  if (!origin) return null;
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return null;
  const { data } = await (db as unknown as SupabaseClient)
    .from('am_publishers')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!data) return null;
  const url = new URL('/admin', origin);
  url.searchParams.set('recipe', recipeId);
  return (
    <a
      href={url.href}
      className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm text-ink-soft hover:bg-sand"
    >
      Opret kladde i AkselsMad ↗
    </a>
  );
}
