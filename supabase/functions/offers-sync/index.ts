import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import {
  copenhagenDay,
  offerWeek,
  offerCacheSchema,
  providerOfferSchema,
  providerFlyerSchema,
  type OfferCache,
} from '../../../packages/validation/src/commerce.ts';
const CHAINS = ['netto', 'fotex', 'bilka', 'rema1000'];
const ALL = [...CHAINS, '365discount', 'brugsen', 'kvickly', 'superbrugsen'];
export async function handleOffers(req: Request): Promise<Response> {
  const origin = req.headers.get('origin');
  const headers: Record<string, string> = {
    Vary: 'Origin',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
  if (
    origin &&
    !(Deno.env.get('AI_ALLOWED_ORIGINS') ?? '')
      .split(',')
      .map((s) => s.trim())
      .includes(origin)
  )
    return new Response(null, { status: 403 });
  if (origin) headers['Access-Control-Allow-Origin'] = origin;
  const reply = (data: unknown, status = 200) => Response.json(data, { status, headers });
  if (req.method === 'OPTIONS') return reply({});
  if (req.method !== 'POST') return reply({ error: 'Metoden understøttes ikke.' }, 405);
  try {
    const auth = req.headers.get('authorization');
    if (!auth?.startsWith('Bearer ')) return reply({ error: 'Log ind igen.' }, 401);
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: auth } },
      auth: { persistSession: false },
    });
    const { data: user } = await db.auth.getUser(auth.slice(7));
    if (!user.user) return reply({ error: 'Log ind igen.' }, 401);
    const raw = await req.text();
    if (raw.length > 1000) return reply({ error: 'Ugyldigt input.' }, 400);
    const parsed = z.object({ householdId: z.uuid() }).strict().safeParse(JSON.parse(raw));
    if (!parsed.success) return reply({ error: 'Ugyldig husstand.' }, 400);
    const { data: member } = await db
      .from('household_members')
      .select('role')
      .eq('household_id', parsed.data.householdId)
      .eq('user_id', user.user.id)
      .maybeSingle();
    if (!member) return reply({ error: 'Ingen adgang.' }, 403);
    const key = Deno.env.get('PREJ_API_KEY');
    if (!key)
      return reply(
        {
          error:
            'Tilbuds-API er ikke aktiveret endnu. Tilføj PREJ_API_KEY i Supabase Secrets. Du kan stadig importere tilbudsaviser.',
        },
        503,
      );
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    );
    const week = offerWeek(copenhagenDay());
    const { data: cached, error: readError } = await admin
      .from('vk_offer_cache')
      .select('*')
      .eq('id', 'prej')
      .maybeSingle();
    if (readError) return reply({ error: 'Tilbudsdatabasen mangler opsætning.' }, 503);
    if (cached?.week === week && cached.payload)
      return reply(offerCacheSchema.parse(cached.payload));
    const { data: claimed, error: claimError } = await admin.rpc('vk_claim_offer_cache', {
      p_week: week,
    });
    if (claimError) return reply({ error: 'Tilbudscachen kunne ikke opdateres.' }, 503);
    if (!claimed)
      return reply(
        {
          error:
            'Den fælles hentning er i gang eller blev afbrudt. Prøv igen om lidt. En administrator kan nulstille en afbrudt cache.',
        },
        503,
      );
    const payload: OfferCache = {
      offers: [],
      flyers: [],
      warnings: [],
      as_of: null,
      fetched_at: new Date().toISOString(),
    };
    let blocked = false;
    async function api(path: string): Promise<unknown | null> {
      if (blocked) return null;
      try {
        const response = await fetch('https://api.prej.app' + path, {
          headers: { Authorization: 'Bearer ' + key },
          signal: AbortSignal.timeout(30000),
        });
        if (!response.ok) {
          if ([401, 403, 429].includes(response.status)) blocked = true;
          payload.warnings.push(
            response.status === 429
              ? 'Prejs kaldgrænse er nået. Listen er ufuldstændig.'
              : 'En kilde kunne ikke hentes (HTTP ' + response.status + ').',
          );
          return null;
        }
        return await response.json();
      } catch {
        payload.warnings.push('En kilde svarede ikke i tide. Listen er ufuldstændig.');
        return null;
      }
    }
    const flyers = z
      .object({ flyers: z.array(providerFlyerSchema), as_of: z.string().nullable() })
      .safeParse(await api('/v1/flyers'));
    if (flyers.success) {
      payload.flyers = flyers.data.flyers.filter((f) => ALL.includes(f.chain_slug)).slice(0, 100);
      payload.as_of = flyers.data.as_of;
    } else payload.warnings.push('Tilbudsaviser kunne ikke aflæses fra API.');
    await Promise.all(CHAINS.map(async (chain) => {
      for (let page = 1; page <= 2; page++) {
        const offers = z
          .object({
            offers: z.array(providerOfferSchema),
            total: z.number().int(),
            as_of: z.string().nullable(),
          })
          .safeParse(
            await api('/v1/offers?chain=' + chain + '&limit=100&page=' + page + '&sort=ends'),
          );
        if (!offers.success) {
          payload.warnings.push('Tilbud fra ' + chain + ' mangler.');
          break;
        }
        payload.offers.push(
          ...offers.data.offers.filter((o) => o.chain_slug === chain).slice(0, 100),
        );
        if (!payload.as_of || (offers.data.as_of && offers.data.as_of < payload.as_of))
          payload.as_of = offers.data.as_of;
        if (offers.data.total <= page * 100) break;
        if (page === 2)
          payload.warnings.push(chain + ': viser højst 200 tilbud, ikke hele kataloget.');
      }
    }));
    payload.warnings.push(
      'Coop vises som tilbudsaviser; priser kan importeres fra PDF eller billede. Kædetilbud er ikke verificeret for en bestemt butik i Aalborg.',
    );
    const valid = offerCacheSchema.parse(payload);
    const { error: saveError } = await admin
      .from('vk_offer_cache')
      .update({ payload: valid })
      .eq('id', 'prej')
      .eq('week', week);
    if (saveError)
      return reply(
        { error: 'Tilbud blev hentet, men cachen kunne ikke gemmes. Kontakt administratoren.' },
        503,
      );
    return reply(valid);
  } catch {
    return reply(
      { error: 'Tilbud kunne ikke hentes. Ingen private indkøbsdata blev sendt til udbyderen.' },
      502,
    );
  }
}
if (import.meta.main) Deno.serve(handleOffers);
