import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { AkselsMadUpdateAction, type KitchenStatus } from './akselsmad-update-action';
export async function AkselsMadUpdate({
  recipeId,
  canEdit,
}: {
  recipeId: string;
  canEdit: boolean;
}) {
  const db = await createClient();
  const { data, error } = await (db as unknown as SupabaseClient).rpc('am_kitchen_status', {
    p_recipe_id: recipeId,
  });
  if (error || !data) return null;
  const status = data as KitchenStatus;
  const origin = process.env.AKSELSMAD_PUBLIC_URL || 'https://akselsmad.dk';
  return (
    <section className="no-print mb-8 rounded-2xl border border-line bg-brand-soft/40 p-5 md:p-7">
      <p className="text-sm font-semibold text-ink-soft">OPSKRIFT FRA AKSELSMAD</p>
      <h2 className="mt-2 font-display text-2xl">
        {status.available && status.public_revision > status.copied_revision
          ? 'Originalen er opdateret'
          : 'Din egen kopi i familiens kogebog'}
      </h2>
      <p className="mt-2 text-sm leading-relaxed">
        Gemt fra udgave {status.copied_revision}.{' '}
        {status.available
          ? `Originalen er nu udgave ${status.public_revision}.`
          : 'Originalen er ikke længere offentlig. Din private kopi er stadig tilgængelig.'}
      </p>
      {status.available && status.slug ? (
        <a
          className="mt-3 inline-flex min-h-11 items-center underline"
          href={new URL('/opskrifter/' + status.slug, origin).href}
        >
          Læs originalopskriften ↗
        </a>
      ) : null}
      {status.available && status.public_revision > status.copied_revision ? (
        canEdit ? (
          <AkselsMadUpdateAction
            key={
              status.recipe_id +
              ':' +
              status.public_revision +
              ':' +
              status.private_version +
              ':' +
              Number(status.modified)
            }
            status={status}
          />
        ) : (
          <p className="mt-3 text-sm">
            Et familiemedlem med redigeringsadgang kan hente den nye udgave.
          </p>
        )
      ) : null}
    </section>
  );
}
