#!/usr/bin/env tsx
/**
 * Mors Opskrifter → Vores Kok import.
 *
 *   pnpm --filter @vores-kok/migration import -- \
 *     --sqlite ./App_dbs/morsopskrifter.db --files ./App_files \
 *     --household <uuid>  [--dry-run] [--invite --site-url https://…] [--report report.json]
 *
 * Env (never commit these):
 *   DATABASE_URL               direct Postgres connection string (Supabase → Connect → Session pooler)
 *   SUPABASE_URL               https://<ref>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY  service role / secret key — only for Storage uploads, only on your machine
 *
 * Idempotent: rows already imported (legacy_import.id_map) are skipped, so the
 * script can be re-run safely, e.g. after family members have signed up to
 * attach their favorites.
 */
import { createClient } from '@supabase/supabase-js';
import { buildMediaPath, MAX_MEDIA_BYTES, MEDIA_BUCKET } from '@vores-kok/domain';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import pg from 'pg';
import { sniffMime, stripMetadata } from './files';
import { readLegacy } from './legacy';
import { buildPlan, legacyRoleToHousehold, type Note } from './map';

const { values: args } = parseArgs({
  options: {
    sqlite: { type: 'string' },
    files: { type: 'string' },
    household: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
    invite: { type: 'boolean', default: false },
    'site-url': { type: 'string' },
    report: { type: 'string', default: 'migration-report.json' },
  },
});

function fail(msg: string): never {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

async function main() {
  if (!args.sqlite) fail('--sqlite <path til morsopskrifter.db> mangler');
  const data = readLegacy(args.sqlite);
  const plan = buildPlan(data);
  const notes: Note[] = [...plan.notes];
  const summary = {
    source_sha256: data.sha256,
    legacy: {
      categories: data.categories.length, recipes: data.recipes.length, ingredients: data.ingredients.length,
      steps: data.steps.length, images: data.recipes.filter((r) => r.OriginalImagePath).length,
      users: data.users.length, favorites: data.favorites.length,
    },
    planned: {
      categories: plan.categories.length, recipes: plan.recipes.length,
      ingredients: plan.recipes.reduce((n, r) => n + r.ingredients.length, 0),
      steps: plan.recipes.reduce((n, r) => n + r.steps.length, 0),
    },
    imported: { categories: 0, recipes: 0, ingredients: 0, steps: 0, media: 0, members: 0, favorites_applied: 0 },
    skipped_existing_recipes: 0,
    invites: [] as Array<{ user: string; email: string; role: string; link: string }>,
    users_without_account: [] as string[],
  };
  console.log('Legacy:', summary.legacy);

  if (args['dry-run']) {
    writeFileSync(args.report!, JSON.stringify({ dry_run: true, summary, notes, plan }, null, 2));
    console.log(`✓ Tørkørsel — intet skrevet. Rapport: ${args.report}`);
    for (const n of notes.filter((x) => x.level === 'warning')) console.log(`  ⚠ ${n.entity} ${n.legacyId}: ${n.message}`);
    return;
  }

  const dbUrl = process.env.DATABASE_URL ?? fail('DATABASE_URL mangler');
  if (!args.household) fail('--household <uuid> mangler (opret husstanden i appen først)');
  const householdId = args.household;
  const client = new pg.Client({ connectionString: dbUrl });
  await client.connect();

  const hh = await client.query<{ id: string; owner: string | null }>(
    `select h.id, (select user_id from public.household_members where household_id = h.id and role = 'owner' order by joined_at limit 1) as owner
     from public.households h where h.id = $1`, [householdId]);
  if (!hh.rows[0]) fail(`Husstand ${householdId} findes ikke`);
  const ownerId = hh.rows[0].owner;

  // Existing mappings (idempotency)
  const existing = await client.query<{ entity: string; legacy_id: string; new_id: string }>(
    'select entity, legacy_id, new_id from legacy_import.id_map where household_id = $1', [householdId]);
  const mapped = new Map(existing.rows.map((r) => [`${r.entity}:${r.legacy_id}`, r.new_id]));
  const byLegacy = await client.query<{ legacy_id: number; id: string }>('select legacy_id, id from public.recipes where household_id = $1 and legacy_id is not null', [householdId]);
  for (const r of byLegacy.rows) mapped.set(`recipe:${r.legacy_id}`, r.id);

  const toImport = plan.recipes.filter((r) => !mapped.has(`recipe:${r.legacyId}`));
  summary.skipped_existing_recipes = plan.recipes.length - toImport.length;
  const recipeIds = new Map(toImport.map((r) => [r.legacyId, randomUUID()]));

  // ── 1. Upload images first (outside the transaction); roll back on failure ──
  const uploaded: Array<{ legacyRecipeId: number; path: string; mime: string; size: number; legacyPath: string }> = [];
  const needsImages = toImport.filter((r) => r.imageFile);
  let storage: ReturnType<typeof createClient> | null = null;
  if (needsImages.length) {
    if (!args.files) fail('--files <App_files-mappe> mangler (opskrifter har billeder)');
    const url = process.env.SUPABASE_URL ?? fail('SUPABASE_URL mangler');
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? fail('SUPABASE_SERVICE_ROLE_KEY mangler (kun til upload af billeder)');
    storage = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    for (const r of needsImages) {
      const file = join(args.files, r.imageFile!);
      if (!existsSync(file)) {
        notes.push({ level: 'warning', entity: 'media', legacyId: r.legacyId, message: `Billedfil ${r.imageFile} findes ikke i App_files` });
        continue;
      }
      const raw = readFileSync(file);
      const mime = sniffMime(raw);
      if (!mime) { notes.push({ level: 'warning', entity: 'media', legacyId: r.legacyId, message: `${r.imageFile} er ikke et understøttet billedformat — ikke overført` }); continue; }
      if (raw.length > MAX_MEDIA_BYTES) { notes.push({ level: 'warning', entity: 'media', legacyId: r.legacyId, message: `${r.imageFile} er større end 25 MB — ikke overført` }); continue; }
      const body = stripMetadata(raw, mime);
      const path = buildMediaPath(householdId, 'recipes', recipeIds.get(r.legacyId)!, randomUUID(), mime);
      const { error } = await storage.storage.from(MEDIA_BUCKET).upload(path, body, { contentType: mime, upsert: false });
      if (error) {
        await storage.storage.from(MEDIA_BUCKET).remove(uploaded.map((u) => u.path));
        fail(`Upload af ${r.imageFile} fejlede: ${error.message}`);
      }
      uploaded.push({ legacyRecipeId: r.legacyId, path, mime, size: body.length, legacyPath: r.imageFile! });
    }
  }

  // ── 2. One transaction for all rows ──
  try {
    await client.query('begin');
    const run = await client.query<{ id: string }>('insert into legacy_import.runs (household_id, source_sha256) values ($1, $2) returning id', [householdId, data.sha256]);
    const runId = run.rows[0]!.id;
    const mapRow = (entity: string, legacyId: string | number, newId: string | null) =>
      client.query('insert into legacy_import.id_map (household_id, entity, legacy_id, new_id, run_id) values ($1,$2,$3,$4,$5) on conflict do nothing', [householdId, entity, String(legacyId), newId, runId]);

    const catIds = new Map<string, string>();
    for (const c of plan.categories) {
      const res = await client.query<{ id: string; inserted: boolean }>(
        `insert into public.categories (household_id, name, icon, legacy_id) values ($1, $2, $3, $4)
         on conflict (household_id, lower(btrim(name))) do update set legacy_id = coalesce(public.categories.legacy_id, excluded.legacy_id)
         returning id, (xmax = 0) as inserted`, [householdId, c.name, c.icon, c.legacyId]);
      catIds.set(c.name.toLowerCase(), res.rows[0]!.id);
      if (res.rows[0]!.inserted) summary.imported.categories++;
      if (c.legacyId != null) await mapRow('category', c.legacyId, res.rows[0]!.id);
    }

    for (const r of toImport) {
      const id = recipeIds.get(r.legacyId)!;
      await client.query(
        `insert into public.recipes (id, household_id, title, category_id, servings, prep_minutes, cook_minutes, difficulty, notes,
           source_type, source_name, legacy_id, legacy_author, legacy_last_modified, legacy_category_icon, created_by, updated_by)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'legacy_import','Mors Opskrifter',$10,$11,$12,$13,$14,$14)`,
        [id, householdId, r.title, r.categoryName ? catIds.get(r.categoryName.toLowerCase()) ?? null : null, r.servings, r.prepMinutes, r.cookMinutes,
          r.difficulty, r.notes, r.legacyId, r.legacyAuthor, r.legacyLastModified, r.legacyCategoryIcon, ownerId]);
      await mapRow('recipe', r.legacyId, id);
      for (const i of r.ingredients) {
        const iid = randomUUID();
        await client.query(
          `insert into public.recipe_ingredients (id, recipe_id, household_id, position, quantity, quantity_max, unit, unit_code, name, original_text)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [iid, id, householdId, i.position, i.quantity, i.quantityMax, i.unit, i.unitCode, i.name, i.originalText]);
        await mapRow('ingredient', i.legacyId, iid);
      }
      for (const s of r.steps) {
        const sid = randomUUID();
        await client.query('insert into public.recipe_steps (id, recipe_id, household_id, position, body) values ($1,$2,$3,$4,$5)', [sid, id, householdId, s.position, s.body]);
        await mapRow('step', s.legacyId, sid);
      }
      summary.imported.recipes++;
      summary.imported.ingredients += r.ingredients.length;
      summary.imported.steps += r.steps.length;
    }
    for (const u of uploaded) {
      const mid = randomUUID();
      await client.query(
        `insert into public.recipe_media (id, recipe_id, household_id, kind, storage_path, mime_type, byte_size, is_cover, legacy_path, created_by)
         values ($1,$2,$3,'photo',$4,$5,$6,true,$7,$8)`,
        [mid, recipeIds.get(u.legacyRecipeId), householdId, u.path, u.mime, u.size, u.legacyPath, ownerId]);
      await mapRow('media', u.legacyRecipeId, mid);
      summary.imported.media++;
    }

    // ── Users & favorites ──
    for (const u of data.users) {
      const email = u.Email?.trim().toLowerCase() || null;
      const match = email ? await client.query<{ id: string }>('select id from auth.users where lower(email) = $1', [email]) : { rows: [] };
      const matched = match.rows[0]?.id ?? null;
      const role = legacyRoleToHousehold(u.Role);
      if (matched) {
        const ins = await client.query(`insert into public.household_members (household_id, user_id, role, invited_by) values ($1,$2,$3,$4) on conflict do nothing`, [householdId, matched, role, ownerId]);
        summary.imported.members += ins.rowCount ?? 0;
        // The person joined on their own; retire any invite we minted earlier.
        await client.query(
          `update public.household_invites set revoked_at = now()
           where id = (select invite_id from legacy_import.users where household_id = $1 and legacy_id = $2)
             and accepted_at is null and revoked_at is null`, [householdId, u.Id]);
      }
      let inviteId: string | null = null;
      if (!matched && email && args.invite) {
        const prev = await client.query<{ invite_id: string | null }>('select invite_id from legacy_import.users where household_id = $1 and legacy_id = $2', [householdId, u.Id]);
        if (!prev.rows[0]?.invite_id) {
          const token = randomBytes(24).toString('base64url');
          const inv = await client.query<{ id: string }>(
            `insert into public.household_invites (household_id, role, email, token_hash, created_by, expires_at)
             values ($1,$2,$3,$4,$5, now() + interval '30 days') returning id`,
            [householdId, role, email, createHash('sha256').update(token).digest('hex'), ownerId]);
          inviteId = inv.rows[0]!.id;
          summary.invites.push({ user: u.DisplayName || u.UserName || u.Id, email, role, link: `${args['site-url'] ?? '<SITE_URL>'}/invite/${token}` });
        }
      }
      if (!matched && !email) summary.users_without_account.push(`${u.DisplayName || u.UserName} (ingen e-mail i den gamle app — invitér manuelt)`);
      await client.query(
        `insert into legacy_import.users (household_id, legacy_id, user_name, display_name, email, legacy_role, matched_user_id, invite_id)
         values ($1,$2,$3,$4,$5,$6,$7,$8)
         on conflict (household_id, legacy_id) do update set matched_user_id = coalesce(excluded.matched_user_id, legacy_import.users.matched_user_id),
           invite_id = coalesce(excluded.invite_id, legacy_import.users.invite_id)`,
        [householdId, u.Id, u.UserName, u.DisplayName, email, u.Role, matched, inviteId]);
    }
    for (const f of data.favorites) {
      await client.query('insert into legacy_import.favorites (household_id, legacy_user_id, legacy_recipe_id) values ($1,$2,$3) on conflict do nothing', [householdId, f.UserId, f.RecipeId]);
    }
    const applied = await client.query<{ n: number }>('select legacy_import.apply_favorites($1) as n', [householdId]);
    summary.imported.favorites_applied = applied.rows[0]!.n;

    await client.query('update legacy_import.runs set finished_at = now(), report = $2 where id = $1', [runId, JSON.stringify({ summary: { ...summary, invites: summary.invites.length }, notes })]);
    await client.query('commit');
  } catch (e) {
    await client.query('rollback');
    if (storage && uploaded.length) await storage.storage.from(MEDIA_BUCKET).remove(uploaded.map((u) => u.path));
    await client.end();
    throw e;
  }
  await client.end();

  writeFileSync(args.report!, JSON.stringify({ summary, notes }, null, 2), { mode: 0o600 });
  console.log('Importeret:', summary.imported, `(sprunget over, allerede importeret: ${summary.skipped_existing_recipes})`);
  for (const n of notes.filter((x) => x.level === 'warning')) console.log(`  ⚠ ${n.entity} ${n.legacyId}: ${n.message}`);
  if (summary.invites.length) console.log(`  ✉ ${summary.invites.length} invitationslinks i ${args.report} — filen indeholder hemmelige links, del dem direkte og slet filen bagefter.`);
  for (const u of summary.users_without_account) console.log(`  • ${u}`);
  console.log(`✓ Færdig. Kør nu verifikationen: pnpm --filter @vores-kok/migration verify -- --sqlite ${args.sqlite} --household ${householdId}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
