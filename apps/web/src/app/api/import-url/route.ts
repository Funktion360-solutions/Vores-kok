import { importResultSchema } from '../../../../../../packages/validation/src/import';
import { can } from '@vores-kok/domain';
import { requireHousehold } from '@/lib/session';
import { fetchRecipeUrl, extractRecipeSource, mapStructuredRecipes } from '@/lib/recipe-url';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function POST(req: Request) {
  const origin = req.headers.get('origin');
  if (!origin || origin !== new URL(req.url).origin) return Response.json({ error: 'Adgang afvist.' }, { status: 403 });
  const { db, household } = await requireHousehold();
  if (!can(household.role, 'recipe.create')) return Response.json({ error: 'Adgang afvist.' }, { status: 403 });
  if (Number(req.headers.get('content-length') ?? 0) > 4096) return Response.json({ error: 'URL er for lang.' }, { status: 413 });
  try {
    const raw = await req.text(); if (raw.length > 4096) throw new Error('URL er for lang.');
    const input: unknown = JSON.parse(raw);
    if (!input || typeof input !== 'object' || !('url' in input) || typeof input.url !== 'string' || input.url.length > 2048) throw new Error('Ugyldig URL.');
    const { data, error } = await db.rpc('reserve_ai_request', { p_household_id: household.id });
    if (error || !data) return Response.json({ error: 'Vent 5 sekunder. Import deler assistentens dagsgrænse.' }, { status: 429 });
    const source = await fetchRecipeUrl(input.url);
    const extracted = extractRecipeSource(source.html);
    const mapped = extracted.structured ? mapStructuredRecipes(extracted.text) : null;
    const parsed = mapped ? importResultSchema.safeParse({ recipes: mapped }) : null;
    return Response.json({ ...extracted, recipes: parsed?.success ? parsed.data.recipes : undefined, url: source.url }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) { return Response.json({ error: e instanceof Error ? e.message : 'Siden kunne ikke hentes.' }, { status: 400 }); }
}
