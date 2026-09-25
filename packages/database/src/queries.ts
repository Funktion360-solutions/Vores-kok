/**
 * Data access shared by web and mobile. Every function takes a Supabase
 * client authenticated as the end user — authorization is enforced by RLS in
 * the database, never here.
 */
import type { Difficulty, HouseholdRole, MediaKind } from '@vores-kok/domain';
import { MEDIA_BUCKET } from '@vores-kok/domain';
import {
  recipeDocumentSchema,
  recipeInputSchema,
  type RecipeDocument,
  type RecipeFilters,
  type RecipeInput,
} from '@vores-kok/validation';
import { DataError, check, maybe, toDataError, unwrap, type VKClient } from './client';
import type { Database, Json, Tables } from './database.gen';

export type Household = { id: string; name: string; role: HouseholdRole; member_count: number; created_at: string };
export type Category = Tables<'categories'>;
export type Tag = Tables<'tags'>;
export type Person = Tables<'people'>;
export type Unit = Tables<'units'>;
export type RecipeVersion = Pick<Tables<'recipe_versions'>, 'id' | 'version' | 'created_at' | 'created_by'> & { snapshot: Json };
export type HouseholdMember = { user_id: string; display_name: string; role: HouseholdRole; joined_at: string; is_me: boolean };
export type HouseholdInvite = Pick<Tables<'household_invites'>, 'id' | 'role' | 'email' | 'created_at' | 'expires_at' | 'accepted_at' | 'revoked_at'>;

export interface RecipeSummary {
  id: string;
  household_id: string;
  title: string;
  description: string | null;
  category_id: string | null;
  category_name: string | null;
  category_icon: string | null;
  difficulty: Difficulty | null;
  servings: number | null;
  yield_unit: string | null;
  prep_minutes: number | null;
  cook_minutes: number | null;
  total_minutes: number | null;
  meal_types: string[];
  origin_text: string | null;
  origin_person_name: string | null;
  legacy_author: string | null;
  cover_path: string | null;
  is_favorite: boolean;
  has_story: boolean;
  archived_at: string | null;
  updated_at: string;
}

export const PAGE_SIZE = 48;

// ─── Households ──────────────────────────────────────────────────────────────
export async function listMyHouseholds(db: VKClient): Promise<Household[]> {
  return unwrap(await db.rpc('my_households')) as Household[];
}

export async function createHousehold(db: VKClient, name: string): Promise<string> {
  return unwrap(await db.rpc('create_household', { p_name: name }));
}

export async function renameHousehold(db: VKClient, householdId: string, name: string): Promise<void> {
  check(await db.from('households').update({ name }).eq('id', householdId).select('id').single());
}

export async function deleteHousehold(db: VKClient, householdId: string): Promise<void> {
  const rows = unwrap(await db.from('households').delete().eq('id', householdId).select('id'));
  if (!rows?.length) throw new DataError('42501', 'Kun ejeren kan slette husstanden.');
}

export async function listMembers(db: VKClient, householdId: string): Promise<HouseholdMember[]> {
  return unwrap(await db.rpc('list_household_members', { p_household_id: householdId })) as HouseholdMember[];
}

export async function setMemberRole(db: VKClient, householdId: string, userId: string, role: HouseholdRole): Promise<void> {
  check(await db.rpc('set_household_member_role', { p_household_id: householdId, p_user_id: userId, p_role: role }));
}

export async function removeMember(db: VKClient, householdId: string, userId: string): Promise<void> {
  check(await db.rpc('remove_household_member', { p_household_id: householdId, p_user_id: userId }));
}

export async function createInvite(db: VKClient, householdId: string, role: Exclude<HouseholdRole, 'owner'>, email?: string | null): Promise<string> {
  return unwrap(
    await db.rpc('create_household_invite', { p_household_id: householdId, p_role: role, ...(email ? { p_email: email } : {}) }),
  );
}

export async function listInvites(db: VKClient, householdId: string): Promise<HouseholdInvite[]> {
  return unwrap(
    await db
      .from('household_invites')
      .select('id, role, email, created_at, expires_at, accepted_at, revoked_at')
      .eq('household_id', householdId)
      .order('created_at', { ascending: false }),
  );
}

export async function revokeInvite(db: VKClient, inviteId: string): Promise<void> {
  check(await db.rpc('revoke_household_invite', { p_invite_id: inviteId }));
}

export async function acceptInvite(db: VKClient, token: string): Promise<string> {
  return unwrap(await db.rpc('accept_household_invite', { p_token: token }));
}

// ─── Profile ─────────────────────────────────────────────────────────────────
export async function getMyProfile(db: VKClient, userId: string): Promise<Tables<'profiles'> | null> {
  return maybe(await db.from('profiles').select('*').eq('id', userId).maybeSingle());
}

export async function updateMyProfile(db: VKClient, userId: string, displayName: string): Promise<void> {
  check(await db.from('profiles').update({ display_name: displayName }).eq('id', userId).select('id').single());
}

// ─── Reference data ──────────────────────────────────────────────────────────
export async function listUnits(db: VKClient): Promise<Unit[]> {
  return unwrap(await db.from('units').select('*').order('sort_order'));
}

export async function listCategories(db: VKClient, householdId: string): Promise<Category[]> {
  return unwrap(await db.from('categories').select('*').eq('household_id', householdId).order('sort_order').order('name'));
}

export async function saveCategory(db: VKClient, c: { id?: string; household_id: string; name: string; icon?: string }): Promise<Category> {
  if (c.id) {
    return unwrap(await db.from('categories').update({ name: c.name, icon: c.icon ?? 'cookie' }).eq('id', c.id).select('*').single());
  }
  return unwrap(await db.from('categories').insert({ household_id: c.household_id, name: c.name, icon: c.icon ?? 'cookie' }).select('*').single());
}

export async function deleteCategory(db: VKClient, id: string): Promise<void> {
  const rows = unwrap(await db.from('categories').delete().eq('id', id).select('id'));
  if (!rows?.length) throw new DataError('42501', 'Kun administratorer kan slette kategorier.');
}

export async function listTags(db: VKClient, householdId: string): Promise<Tag[]> {
  return unwrap(await db.from('tags').select('*').eq('household_id', householdId).order('name'));
}

export async function listPeople(db: VKClient, householdId: string): Promise<Person[]> {
  return unwrap(await db.from('people').select('*').eq('household_id', householdId).order('name'));
}

export async function savePerson(
  db: VKClient,
  p: { id?: string; household_id: string; name: string; relation?: string | null; birth_year?: number | null; death_year?: number | null; bio?: string | null },
): Promise<Person> {
  const values = { name: p.name, relation: p.relation ?? null, birth_year: p.birth_year ?? null, death_year: p.death_year ?? null, bio: p.bio ?? null };
  if (p.id) return unwrap(await db.from('people').update(values).eq('id', p.id).select('*').single());
  return unwrap(await db.from('people').insert({ household_id: p.household_id, ...values }).select('*').single());
}

export async function deletePerson(db: VKClient, id: string): Promise<void> {
  const rows = unwrap(await db.from('people').delete().eq('id', id).select('id'));
  if (!rows?.length) throw new DataError('42501', 'Kun administratorer kan slette personer.');
}

// ─── Recipes ─────────────────────────────────────────────────────────────────
export async function searchRecipes(
  db: VKClient,
  householdId: string,
  f: RecipeFilters = {},
  pageSize = PAGE_SIZE,
): Promise<{ items: RecipeSummary[]; total: number }> {
  const page = f.page ?? 1;
  const args: Database['public']['Functions']['search_recipes']['Args'] = {
    p_household_id: householdId,
    p_limit: pageSize,
    p_offset: (page - 1) * pageSize,
    p_sort: f.sort ?? (f.q ? 'relevance' : 'title'),
  };
  if (f.q) args.p_query = f.q;
  if (f.category?.length) args.p_category_ids = f.category;
  if (f.tag?.length) args.p_tag_ids = f.tag;
  if (f.difficulty?.length) args.p_difficulties = f.difficulty;
  if (f.meal?.length) args.p_meal_types = f.meal;
  if (f.maxTime) args.p_max_total_minutes = f.maxTime;
  if (f.maxPrep) args.p_max_prep_minutes = f.maxPrep;
  if (f.favorites) args.p_favorites_only = true;
  if (f.family) args.p_has_family_history = true;
  if (f.person) args.p_origin_person_id = f.person;
  if (f.ingredients?.length) args.p_ingredients = f.ingredients;
  if (f.archived) args.p_include_archived = true;
  const rows = unwrap(await db.rpc('search_recipes', args)) ?? [];
  const items = rows.map(({ rank: _rank, total_count: _total, ...r }) => r as unknown as RecipeSummary);
  return { items, total: rows[0]?.total_count ?? 0 };
}

export function parseRecipeDocument(raw: unknown): RecipeDocument {
  const res = recipeDocumentSchema.safeParse(raw);
  if (!res.success) {
    throw new DataError('INVALID_DOCUMENT', 'Opskriften kunne ikke læses.', { cause: res.error });
  }
  return res.data;
}

export async function getRecipe(db: VKClient, id: string): Promise<RecipeDocument | null> {
  const raw = maybe(await db.rpc('get_recipe', { p_recipe_id: id }));
  return raw == null ? null : parseRecipeDocument(raw);
}

export async function getRecipesSince(db: VKClient, householdId: string, since: string | null, limit = 200): Promise<RecipeDocument[]> {
  const rows = unwrap(
    await db.rpc('get_recipes_since', { p_household_id: householdId, p_limit: limit, ...(since ? { p_since: since } : {}) }),
  );
  return (rows ?? []).map(parseRecipeDocument);
}

/** Lists ids of all (incl. archived) recipes in a household — used to purge deleted recipes from offline caches. */
export async function listRecipeIds(db: VKClient, householdId: string): Promise<string[]> {
  const rows = unwrap(await db.from('recipes').select('id').eq('household_id', householdId));
  return (rows ?? []).map((r) => r.id);
}

export async function saveRecipe(db: VKClient, input: RecipeInput): Promise<{ id: string; version: number }> {
  const parsed = recipeInputSchema.safeParse(input);
  if (!parsed.success) throw new DataError('22023', parsed.error.issues[0]?.message ?? 'Ugyldigt input.', { cause: parsed.error });
  const res = unwrap(await db.rpc('save_recipe', { p_recipe: parsed.data as unknown as Json }));
  return res as unknown as { id: string; version: number };
}

export async function setFavorite(db: VKClient, recipeId: string, favorite: boolean): Promise<boolean> {
  return unwrap(await db.rpc('set_favorite', { p_recipe_id: recipeId, p_favorite: favorite }));
}

export async function setRecipeArchived(db: VKClient, recipeId: string, archived: boolean): Promise<void> {
  check(await db.rpc('set_recipe_archived', { p_recipe_id: recipeId, p_archived: archived }));
}

export async function deleteRecipe(db: VKClient, recipeId: string): Promise<void> {
  const media = unwrap(await db.from('recipe_media').select('storage_path').eq('recipe_id', recipeId));
  const rows = unwrap(await db.from('recipes').delete().eq('id', recipeId).select('id'));
  if (!rows?.length) throw new DataError('42501', 'Kun administratorer kan slette opskrifter. Du kan arkivere den i stedet.');
  if (media?.length) {
    // Best effort: rows are gone; orphaned objects are also caught by the storage cleanup job (docs/storage.md).
    await db.storage.from(MEDIA_BUCKET).remove(media.map((m) => m.storage_path));
  }
}

export async function listRecipeVersions(db: VKClient, recipeId: string): Promise<RecipeVersion[]> {
  return unwrap(
    await db.from('recipe_versions').select('id, version, created_at, created_by, snapshot').eq('recipe_id', recipeId).order('version', { ascending: false }),
  );
}

// ─── Stories ─────────────────────────────────────────────────────────────────
export async function saveStory(
  db: VKClient,
  s: { id?: string; recipe_id: string; household_id: string; title?: string | null; body: string; person_id?: string | null; told_by?: string | null; approx_year?: number | null; historical_context?: string | null },
): Promise<void> {
  const values = {
    title: s.title ?? null,
    body: s.body,
    person_id: s.person_id ?? null,
    told_by: s.told_by ?? null,
    approx_year: s.approx_year ?? null,
    historical_context: s.historical_context ?? null,
  };
  if (s.id) check(await db.from('recipe_stories').update(values).eq('id', s.id).select('id').single());
  else check(await db.from('recipe_stories').insert({ recipe_id: s.recipe_id, household_id: s.household_id, ...values }).select('id').single());
}

export async function deleteStory(db: VKClient, id: string): Promise<void> {
  check(await db.from('recipe_stories').delete().eq('id', id));
}

// ─── Notes ───────────────────────────────────────────────────────────────────
export async function addNote(db: VKClient, n: { recipe_id: string; household_id: string; user_id: string; body: string; visibility: 'private' | 'household' }): Promise<void> {
  check(await db.from('recipe_notes').insert(n).select('id').single());
}

export async function deleteNote(db: VKClient, id: string): Promise<void> {
  check(await db.from('recipe_notes').delete().eq('id', id));
}

// ─── Media ───────────────────────────────────────────────────────────────────
export async function addMediaRow(
  db: VKClient,
  m: { recipe_id: string; household_id: string; storage_path: string; mime_type: string; kind: MediaKind; byte_size?: number; width?: number | null; height?: number | null; caption?: string | null; approx_year?: number | null; is_cover?: boolean },
): Promise<void> {
  if (m.is_cover) {
    check(await db.from('recipe_media').update({ is_cover: false }).eq('recipe_id', m.recipe_id).eq('is_cover', true));
  }
  const res = await db.from('recipe_media').insert(m).select('id').single();
  if (res.error) {
    await db.storage.from(MEDIA_BUCKET).remove([m.storage_path]);
    throw toDataError(res.error);
  }
}

export async function updateMedia(db: VKClient, id: string, patch: { caption?: string | null; kind?: MediaKind; approx_year?: number | null }): Promise<void> {
  check(await db.from('recipe_media').update(patch).eq('id', id).select('id').single());
}

export async function setCoverMedia(db: VKClient, recipeId: string, mediaId: string): Promise<void> {
  check(await db.from('recipe_media').update({ is_cover: false }).eq('recipe_id', recipeId).eq('is_cover', true));
  check(await db.from('recipe_media').update({ is_cover: true }).eq('id', mediaId).select('id').single());
}

export async function deleteMedia(db: VKClient, id: string, storagePath: string): Promise<void> {
  check(await db.from('recipe_media').delete().eq('id', id));
  await db.storage.from(MEDIA_BUCKET).remove([storagePath]);
}

/** Signed URLs for private media (default 1 hour). Missing/forbidden paths are skipped. */
export async function signMediaUrls(db: VKClient, paths: string[], expiresIn = 3600): Promise<Record<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))];
  if (!unique.length) return {};
  const { data, error } = await db.storage.from(MEDIA_BUCKET).createSignedUrls(unique, expiresIn);
  if (error) throw toDataError(error);
  const out: Record<string, string> = {};
  for (const d of data ?? []) if (d.path && d.signedUrl && !d.error) out[d.path] = d.signedUrl;
  return out;
}
