#!/usr/bin/env tsx
/**
 * Verifies an import by comparing the legacy SQLite file with what is in
 * Postgres for the household. Exits non-zero on any mismatch.
 *
 *   DATABASE_URL=… pnpm --filter @vores-kok/migration verify -- --sqlite morsopskrifter.db --household <uuid>
 */
import { parseArgs } from 'node:util';
import pg from 'pg';
import { readLegacy } from './legacy';
import { buildPlan } from './map';

export interface Check { name: string; expected: unknown; actual: unknown; ok: boolean }

export async function verify(sqlite: string, householdId: string, dbUrl: string): Promise<Check[]> {
  const data = readLegacy(sqlite);
  const plan = buildPlan(data);
  const db = new pg.Client({ connectionString: dbUrl });
  await db.connect();
  const checks: Check[] = [];
  const check = (name: string, expected: unknown, actual: unknown) =>
    checks.push({ name, expected, actual, ok: JSON.stringify(expected) === JSON.stringify(actual) });
  try {
    const one = async <T>(sql: string, params: unknown[] = []) => (await db.query(sql, params)).rows[0] as T;
    const rows = async <T>(sql: string, params: unknown[] = []) => (await db.query(sql, params)).rows as T[];

    const recipes = await rows<{ id: string; legacy_id: number; title: string }>(
      'select id, legacy_id, title from public.recipes where household_id = $1 and legacy_id is not null order by legacy_id', [householdId]);
    check('Antal opskrifter', data.recipes.length, recipes.length);
    check('Alle legacy-id’er findes', data.recipes.map((r) => r.Id), recipes.map((r) => r.legacy_id));

    const ingCounts = await rows<{ legacy_id: number; n: string }>(
      `select r.legacy_id, count(i.id) as n from public.recipes r left join public.recipe_ingredients i on i.recipe_id = r.id
       where r.household_id = $1 and r.legacy_id is not null group by r.legacy_id order by r.legacy_id`, [householdId]);
    const stepCounts = await rows<{ legacy_id: number; n: string }>(
      `select r.legacy_id, count(s.id) as n from public.recipes r left join public.recipe_steps s on s.recipe_id = r.id
       where r.household_id = $1 and r.legacy_id is not null group by r.legacy_id order by r.legacy_id`, [householdId]);
    const nonEmptyIngs = (id: number) => data.ingredients.filter((i) => i.RecipeId === id && [i.Amount, i.Unit, i.Name].some((x) => (x ?? '').trim())).length;
    const nonEmptySteps = (id: number) => data.steps.filter((s) => s.RecipeId === id && (s.Text ?? '').trim()).length;
    check('Ingredienser pr. opskrift', data.recipes.map((r) => [r.Id, nonEmptyIngs(r.Id)]), ingCounts.map((r) => [r.legacy_id, Number(r.n)]));
    check('Trin pr. opskrift', data.recipes.map((r) => [r.Id, nonEmptySteps(r.Id)]), stepCounts.map((r) => [r.legacy_id, Number(r.n)]));
    check('Ingredienser i alt', data.ingredients.filter((i) => [i.Amount, i.Unit, i.Name].some((x) => (x ?? '').trim())).length, ingCounts.reduce((n, r) => n + Number(r.n), 0));

    const withImage = data.recipes.filter((r) => r.OriginalImagePath).map((r) => r.Id);
    const media = await rows<{ legacy_id: number; storage_path: string; stored: boolean }>(
      `select r.legacy_id, m.storage_path, exists (select 1 from storage.objects o where o.bucket_id = 'household-media' and o.name = m.storage_path) as stored
       from public.recipe_media m join public.recipes r on r.id = m.recipe_id
       where m.household_id = $1 and m.legacy_path is not null order by r.legacy_id`, [householdId]);
    check('Billeder overført (opskrifter med billede)', withImage, media.map((m) => m.legacy_id));
    check('Billedfiler findes i Storage', media.map(() => true), media.map((m) => m.stored));

    const cats = await one<{ n: string }>('select count(*) as n from public.categories where household_id = $1 and lower(btrim(name)) = any($2)', [householdId, plan.categories.map((c) => c.name.toLowerCase())]);
    check('Kategorier', plan.categories.length, Number(cats.n));
    const catLinks = await rows<{ legacy_id: number; name: string | null }>(
      'select r.legacy_id, c.name from public.recipes r left join public.categories c on c.id = r.category_id where r.household_id = $1 and r.legacy_id is not null order by r.legacy_id', [householdId]);
    check('Kategori pr. opskrift', data.recipes.map((r) => [r.Id, r.Category.trim() || null]), catLinks.map((r) => [r.legacy_id, r.name]));

    const favs = await one<{ n: string }>('select count(*) as n from legacy_import.favorites where household_id = $1', [householdId]);
    check('Favoritter bevaret (anvendt + afventende)', data.favorites.length, Number(favs.n));
    const users = await one<{ n: string }>('select count(*) as n from legacy_import.users where household_id = $1', [householdId]);
    check('Brugere registreret', data.users.length, Number(users.n));

    // Representative recipes: first, last and the one with most ingredients — compared field by field.
    const richest = [...plan.recipes].sort((a, b) => b.ingredients.length - a.ingredients.length)[0];
    const sample = [...new Map([plan.recipes[0], plan.recipes.at(-1), richest].filter(Boolean).map((r) => [r!.legacyId, r!])).values()];
    for (const p of sample) {
      const doc = await one<{ title: string; notes: string | null; servings: number | null; legacy_author: string | null; ings: string[] | null; steps: string[] | null }>(
        `select r.title, r.notes, r.servings, r.legacy_author,
                (select array_agg(i.original_text order by i.position) from public.recipe_ingredients i where i.recipe_id = r.id) as ings,
                (select array_agg(s.body order by s.position) from public.recipe_steps s where s.recipe_id = r.id) as steps
         from public.recipes r where r.household_id = $1 and r.legacy_id = $2`, [householdId, p.legacyId]);
      check(`Opskrift #${p.legacyId} “${p.title}”`,
        { title: p.title, notes: p.notes, servings: p.servings, author: p.legacyAuthor, ings: p.ingredients.map((i) => i.originalText), steps: p.steps.map((s) => s.body) },
        { title: doc?.title, notes: doc?.notes, servings: doc?.servings, author: doc?.legacy_author, ings: doc?.ings ?? [], steps: doc?.steps ?? [] });
    }
  } finally {
    await db.end();
  }
  return checks;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { values } = parseArgs({ options: { sqlite: { type: 'string' }, household: { type: 'string' } } });
  if (!values.sqlite || !values.household || !process.env.DATABASE_URL) {
    console.error('Brug: DATABASE_URL=… verify --sqlite <db> --household <uuid>');
    process.exit(2);
  }
  const checks = await verify(values.sqlite, values.household, process.env.DATABASE_URL);
  for (const c of checks) {
    console.log(`${c.ok ? '✓' : '✗'} ${c.name}${c.ok ? '' : `\n    forventet: ${JSON.stringify(c.expected)}\n    fundet:    ${JSON.stringify(c.actual)}`}`);
  }
  const failed = checks.filter((c) => !c.ok).length;
  console.log(failed ? `\n✗ ${failed} kontrol(ler) fejlede` : `\n✓ Alle ${checks.length} kontroller bestået`);
  process.exit(failed ? 1 : 0);
}
