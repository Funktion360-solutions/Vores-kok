/**
 * Kitchen data access (meal plan, shopping, pantry) shared by web and mobile.
 * Aggregation happens in @vores-kok/domain; this module only moves data.
 */
import {
  aggregateShoppingLines, categorizeIngredient, mergeIntoList, parseIngredientLine, scaleFactor, scaleQuantity, subtractPantry,
  type MealSlot, type PantryStock, type ShoppingLine,
} from '@vores-kok/domain';
import { pantryItemSchema, planEntrySchema, type PantryItemInput, type PlanEntryInput, type RecipeDocument } from '@vores-kok/validation';
import { check, DataError, unwrap, type VKClient } from './client';
import type { Json, Tables } from './database.gen';
import { getRecipe } from './queries';

export type PlanEntry = Tables<'meal_plan_entries'> & { recipe_title: string | null; recipe_servings: number | null };
export type ShoppingList = Tables<'shopping_lists'> & { open_count: number; total_count: number };
export type ShoppingItem = Tables<'shopping_list_items'>;
export type PantryLocation = Tables<'pantry_locations'>;
export type PantryItem = Tables<'pantry_items'>;

// ─── Meal plan ───────────────────────────────────────────────────────────────
export async function listPlanEntries(db: VKClient, householdId: string, from: string, to: string): Promise<PlanEntry[]> {
  const rows = unwrap(await db.from('meal_plan_entries').select('*').eq('household_id', householdId).gte('plan_date', from).lte('plan_date', to)
    .order('plan_date').order('slot').order('position'));
  const ids = [...new Set(rows.map((r) => r.recipe_id).filter((x): x is string => Boolean(x)))];
  const recipes = ids.length ? unwrap(await db.from('recipes').select('id, title, servings').in('id', ids)) : [];
  const byId = new Map(recipes.map((r) => [r.id, r]));
  return rows.map((r) => ({ ...r, recipe_title: r.recipe_id ? byId.get(r.recipe_id)?.title ?? null : null, recipe_servings: r.recipe_id ? byId.get(r.recipe_id)?.servings ?? null : null }));
}

export async function savePlanEntry(db: VKClient, input: PlanEntryInput): Promise<void> {
  const p = planEntrySchema.safeParse(input);
  if (!p.success) throw new DataError('22023', p.error.issues[0]?.message ?? 'Ugyldigt input.', { cause: p.error });
  const { id, household_id, ...values } = p.data;
  const row = { ...values, recipe_id: values.recipe_id ?? null, title: values.title ?? null, servings: values.servings ?? null, notes: values.notes ?? null };
  if (id) check(await db.from('meal_plan_entries').update(row).eq('id', id).select('id').single());
  else check(await db.from('meal_plan_entries').insert({ household_id, ...row }).select('id').single());
}

export async function movePlanEntry(db: VKClient, id: string, planDate: string, slot: MealSlot): Promise<void> {
  check(await db.from('meal_plan_entries').update({ plan_date: planDate, slot }).eq('id', id).select('id').single());
}

export async function deletePlanEntry(db: VKClient, id: string): Promise<void> {
  check(await db.from('meal_plan_entries').delete().eq('id', id));
}

// ─── Shopping lists ──────────────────────────────────────────────────────────
export async function listShoppingLists(db: VKClient, householdId: string, includeArchived = false): Promise<ShoppingList[]> {
  let q = db.from('shopping_lists').select('*').eq('household_id', householdId);
  if (!includeArchived) q = q.is('archived_at', null);
  const lists = unwrap(await q.order('updated_at', { ascending: false }));
  if (!lists.length) return [];
  const items = unwrap(await db.from('shopping_list_items').select('list_id, checked').in('list_id', lists.map((l) => l.id)));
  return lists.map((l) => {
    const mine = items.filter((i) => i.list_id === l.id);
    return { ...l, total_count: mine.length, open_count: mine.filter((i) => !i.checked).length };
  });
}

export async function createShoppingList(db: VKClient, householdId: string, name: string): Promise<Tables<'shopping_lists'>> {
  return unwrap(await db.from('shopping_lists').insert({ household_id: householdId, name: name.trim() }).select('*').single());
}

export async function renameShoppingList(db: VKClient, id: string, name: string): Promise<void> {
  check(await db.from('shopping_lists').update({ name: name.trim() }).eq('id', id).select('id').single());
}

export async function archiveShoppingList(db: VKClient, id: string, archived: boolean): Promise<void> {
  check(await db.from('shopping_lists').update({ archived_at: archived ? new Date().toISOString() : null }).eq('id', id).select('id').single());
}

export async function deleteShoppingList(db: VKClient, id: string): Promise<void> {
  check(await db.from('shopping_lists').delete().eq('id', id));
}

export async function listShoppingItems(db: VKClient, listId: string): Promise<ShoppingItem[]> {
  return unwrap(await db.from('shopping_list_items').select('*').eq('list_id', listId).order('position').order('created_at'));
}

export interface ShoppingItemWrite {
  id?: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  unit_code: string | null;
  category: string;
  note: string | null;
  source_recipe_ids: string[];
  position?: number;
}

/** Atomic upsert (idempotent by id — used for offline replay too). */
export async function upsertShoppingItems(db: VKClient, listId: string, items: ShoppingItemWrite[]): Promise<void> {
  if (!items.length) return;
  check(await db.rpc('upsert_shopping_items', { p_list_id: listId, p_items: items as unknown as Json }));
}

/** Adds lines to a list, merging with unchecked items of the same ingredient. */
export async function addLinesToList(db: VKClient, listId: string, lines: ShoppingLine[]): Promise<number> {
  const existing = await listShoppingItems(db, listId);
  const upserts = mergeIntoList(existing.map((e) => ({ ...e, quantity: e.quantity == null ? null : Number(e.quantity) })), lines);
  const maxPos = existing.reduce((m, e) => Math.max(m, e.position), 0);
  await upsertShoppingItems(db, listId, upserts.map((u, i) => ({ ...u, position: u.id ? undefined : maxPos + i + 1 })));
  return upserts.length;
}

/** Parses free text ("2 l mælk") into a single shopping line. */
export function parseShoppingInput(text: string): ShoppingItemWrite {
  const p = parseIngredientLine(text);
  return { name: p.name, quantity: p.quantity, unit: p.unit, unit_code: p.unitCode, category: categorizeIngredient(p.name), note: p.preparation, source_recipe_ids: [] };
}

export async function setShoppingItemChecked(db: VKClient, id: string, checked: boolean): Promise<void> {
  check(await db.rpc('set_shopping_item_checked', { p_item_id: id, p_checked: checked }));
}

export async function updateShoppingItem(db: VKClient, id: string, patch: Partial<Pick<ShoppingItem, 'name' | 'quantity' | 'unit' | 'unit_code' | 'category' | 'note'>>): Promise<void> {
  check(await db.from('shopping_list_items').update(patch).eq('id', id).select('id').single());
}

export async function deleteShoppingItem(db: VKClient, id: string): Promise<void> {
  check(await db.from('shopping_list_items').delete().eq('id', id));
}

export async function clearCheckedItems(db: VKClient, listId: string): Promise<void> {
  check(await db.from('shopping_list_items').delete().eq('list_id', listId).eq('checked', true));
}

/** Scaled shopping lines for one recipe. Optional ingredients are skipped. */
export function recipeShoppingLines(doc: RecipeDocument, servings?: number | null): ShoppingLine[] {
  const factor = scaleFactor(doc.servings, servings ?? doc.servings);
  return doc.ingredients.filter((i) => !i.is_optional).map((i) => {
    const s = scaleQuantity({ quantity: i.quantity, quantityMax: i.quantity_max, unit: i.unit, unitCode: i.unit_code, isScalable: i.is_scalable }, factor);
    // Buy the upper end of a range ("1-2 fed" → 2 fed).
    return { name: i.name, quantity: s.quantityMax ?? s.quantity, unit: s.unit, unitCode: s.unitCode, sourceRecipeIds: [doc.id] };
  });
}

/** Shopping lines for all recipe entries in a date range, scaled to each entry's servings. */
export async function planShoppingLines(db: VKClient, householdId: string, from: string, to: string): Promise<{ lines: ShoppingLine[]; recipes: number }> {
  const entries = (await listPlanEntries(db, householdId, from, to)).filter((e) => e.recipe_id);
  const docs = new Map<string, RecipeDocument>();
  for (const id of new Set(entries.map((e) => e.recipe_id!))) {
    const d = await getRecipe(db, id);
    if (d) docs.set(id, d);
  }
  const lines = entries.flatMap((e) => { const d = docs.get(e.recipe_id!); return d ? recipeShoppingLines(d, e.servings ?? d.servings) : []; });
  return { lines, recipes: entries.length };
}

/** Preview for "add to list": aggregated lines for display + the plain lines to add. */
export function previewLines(lines: ShoppingLine[], pantry: PantryStock[] = [], skipPantry = false) {
  if (!skipPantry) return { lines: aggregateShoppingLines(lines), input: lines, covered: [] as string[] };
  const r = subtractPantry(lines, pantry);
  return { lines: aggregateShoppingLines(r.lines), input: r.lines, covered: r.covered };
}

// ─── Pantry ──────────────────────────────────────────────────────────────────
export async function listPantryLocations(db: VKClient, householdId: string): Promise<PantryLocation[]> {
  return unwrap(await db.from('pantry_locations').select('*').eq('household_id', householdId).order('position').order('name'));
}

export async function savePantryLocation(db: VKClient, l: { id?: string; household_id: string; name: string; kind?: PantryLocation['kind'] }): Promise<PantryLocation> {
  if (l.id) return unwrap(await db.from('pantry_locations').update({ name: l.name.trim(), kind: l.kind ?? 'other' }).eq('id', l.id).select('*').single());
  return unwrap(await db.from('pantry_locations').insert({ household_id: l.household_id, name: l.name.trim(), kind: l.kind ?? 'other', position: 99 }).select('*').single());
}

export async function deletePantryLocation(db: VKClient, id: string): Promise<void> {
  check(await db.from('pantry_locations').delete().eq('id', id));
}

export async function listPantryItems(db: VKClient, householdId: string): Promise<PantryItem[]> {
  return unwrap(await db.from('pantry_items').select('*').eq('household_id', householdId).order('name'));
}

export async function savePantryItem(db: VKClient, input: PantryItemInput): Promise<void> {
  const p = pantryItemSchema.safeParse(input);
  if (!p.success) throw new DataError('22023', p.error.issues[0]?.message ?? 'Ugyldigt input.', { cause: p.error });
  const { id, household_id, ...v } = p.data;
  const row = { location_id: v.location_id, name: v.name, quantity: v.quantity ?? null, unit: v.unit ?? null, unit_code: v.unit_code ?? null, best_before: v.best_before ?? null, opened_on: v.opened_on ?? null, notes: v.notes ?? null };
  if (id) check(await db.from('pantry_items').update(row).eq('id', id).select('id').single());
  else check(await db.from('pantry_items').insert({ household_id, ...row }).select('id').single());
}

export async function deletePantryItem(db: VKClient, id: string): Promise<void> {
  check(await db.from('pantry_items').delete().eq('id', id));
}

export function pantryStock(items: PantryItem[]): PantryStock[] {
  return items.map((i) => ({ name: i.name, quantity: i.quantity == null ? null : Number(i.quantity), unit: i.unit, unit_code: i.unit_code }));
}
