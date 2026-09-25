/**
 * Pure mapping from Mors Opskrifter rows to Vores Kok rows. No I/O, fully
 * unit-tested. Every decision that changes or interprets data is recorded as
 * a note so nothing is lost silently (see docs/legacy/migration-mapping.md).
 */
import { parseDifficulty, parseQuantity, resolveUnit, type Difficulty } from '@vores-kok/domain';
import type { LegacyData, LegacyIngredient, LegacyRecipe } from './legacy';

export interface PlannedIngredient {
  legacyId: number;
  position: number;
  quantity: number | null;
  quantityMax: number | null;
  unit: string | null;
  unitCode: string | null;
  name: string;
  originalText: string;
}
export interface PlannedStep { legacyId: number; position: number; body: string }
export interface PlannedRecipe {
  legacyId: number;
  title: string;
  categoryName: string | null;
  legacyCategoryIcon: string | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  servings: number | null;
  difficulty: Difficulty | null;
  legacyAuthor: string | null;
  legacyLastModified: string | null;
  notes: string | null;
  imageFile: string | null;
  ingredients: PlannedIngredient[];
  steps: PlannedStep[];
}
export interface PlannedCategory { legacyId: number | null; name: string; icon: string }
export interface Note { level: 'info' | 'warning'; entity: string; legacyId: string | number; message: string }

export interface Plan {
  categories: PlannedCategory[];
  recipes: PlannedRecipe[];
  notes: Note[];
}

const ICON = /^[a-z0-9-]{1,40}$/;
const clamp = (s: string, max: number) => (s.length > max ? s.slice(0, max) : s);

/** EF stores DateTime as "yyyy-MM-dd HH:mm:ss[.fffffff]" (local time, Europe/Copenhagen in practice). */
export function parseLegacyDate(v: string | null | undefined): string | null {
  if (!v) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(\.\d+)?/.exec(v.trim());
  if (!m) return null;
  // Interpret as Danish local time; offset by CET/CEST using Intl.
  const utcGuess = Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!, +m[6]!);
  const tz = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Copenhagen', timeZoneName: 'shortOffset' }).formatToParts(new Date(utcGuess));
  const off = tz.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+1';
  const hours = Number(/GMT([+-]\d+)/.exec(off)?.[1] ?? 1);
  return new Date(utcGuess - hours * 3600_000).toISOString();
}

export function mapIngredient(i: LegacyIngredient, position: number, notes: Note[]): PlannedIngredient | null {
  const amount = (i.Amount ?? '').trim();
  let unitText = (i.Unit ?? '').trim();
  let name = (i.Name ?? '').trim();
  const originalText = [amount, unitText, name].filter(Boolean).join(' ');
  if (!originalText) {
    notes.push({ level: 'info', entity: 'ingredient', legacyId: i.Id, message: 'Tom ingredienslinje sprunget over' });
    return null;
  }
  // Legacy seed stored "1 æg" as Amount=1, Unit="æg", Name="". A "unit" that is
  // not a unit and no name means the unit field held the ingredient.
  if (!name && unitText && !resolveUnit(unitText)) {
    name = unitText;
    unitText = '';
    notes.push({ level: 'info', entity: 'ingredient', legacyId: i.Id, message: `Enhed “${i.Unit}” tolket som ingrediensnavn` });
  }
  if (!name) {
    name = originalText;
  }
  const q = amount ? parseQuantity(amount) : null;
  if (amount && !q) {
    // Keep unparseable amounts ("en smule", "efter smag") as part of the name.
    notes.push({ level: 'info', entity: 'ingredient', legacyId: i.Id, message: `Mængden “${amount}” er ikke et tal — bevaret som tekst` });
    name = originalText;
    unitText = '';
  }
  const unit = unitText ? resolveUnit(unitText) : undefined;
  return {
    legacyId: i.Id,
    position,
    quantity: q?.quantity ?? null,
    quantityMax: q?.quantityMax ?? null,
    unit: unitText ? clamp(unitText, 40) : null,
    unitCode: unit?.code ?? null,
    name: clamp(name, 200),
    originalText: clamp(originalText, 500),
  };
}

export function mapRecipe(r: LegacyRecipe, ings: LegacyIngredient[], steps: LegacyData['steps'], notes: Note[]): PlannedRecipe {
  const difficulty = parseDifficulty(r.Difficulty);
  if (r.Difficulty && !difficulty) notes.push({ level: 'warning', entity: 'recipe', legacyId: r.Id, message: `Ukendt sværhedsgrad “${r.Difficulty}” — sat til tom` });
  const title = (r.Title ?? '').trim() || `Opskrift #${r.Id}`;
  if (!(r.Title ?? '').trim()) notes.push({ level: 'warning', entity: 'recipe', legacyId: r.Id, message: 'Manglende titel — erstattet' });
  // 0 was the legacy form default and means "not specified".
  const zeroToNull = (n: number | null | undefined) => (n && n > 0 ? n : null);
  const servings = zeroToNull(r.Servings);
  const mappedIngs = ings.map((i, idx) => mapIngredient(i, idx, notes)).filter((x): x is PlannedIngredient => x !== null)
    .map((x, idx) => ({ ...x, position: idx }));
  const mappedSteps = steps
    .filter((s) => (s.Text ?? '').trim())
    .map((s, idx) => ({ legacyId: s.Id, position: idx, body: clamp(s.Text.trim(), 5000) }));
  return {
    legacyId: r.Id,
    title: clamp(title, 200),
    categoryName: (r.Category ?? '').trim() || null,
    legacyCategoryIcon: (r.CategoryIcon ?? '').trim() || null,
    prepMinutes: zeroToNull(r.PrepTimeMinutes),
    cookMinutes: zeroToNull(r.CookTimeMinutes),
    servings: servings && servings <= 1000 ? servings : null,
    difficulty,
    legacyAuthor: (r.Author ?? '').trim() || null,
    legacyLastModified: parseLegacyDate(r.LastModified),
    notes: (r.Notes ?? '').trim() || null,
    imageFile: r.OriginalImagePath ? r.OriginalImagePath.split(/[\\/]/).pop() ?? null : null,
    ingredients: mappedIngs,
    steps: mappedSteps,
  };
}

export function buildPlan(data: LegacyData): Plan {
  const notes: Note[] = [];
  for (const [t, cols] of Object.entries(data.unknownColumns)) {
    notes.push({ level: 'warning', entity: 'schema', legacyId: t, message: `Ukendte kolonner ${cols.join(', ')} — ikke migreret, dokumentér før import` });
  }
  for (const t of data.unknownTables) notes.push({ level: 'warning', entity: 'schema', legacyId: t, message: 'Ukendt tabel — ikke migreret' });

  const categories = new Map<string, PlannedCategory>();
  for (const c of data.categories) {
    const name = c.Name.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (categories.has(key)) {
      notes.push({ level: 'warning', entity: 'category', legacyId: c.Id, message: `Dublet “${name}” slået sammen` });
      continue;
    }
    categories.set(key, { legacyId: c.Id, name: clamp(name, 100), icon: ICON.test(c.Icon) ? c.Icon : 'cookie' });
  }

  const ingByRecipe = new Map<number, LegacyIngredient[]>();
  for (const i of data.ingredients) ingByRecipe.set(i.RecipeId, [...(ingByRecipe.get(i.RecipeId) ?? []), i]);
  const stepsByRecipe = new Map<number, LegacyData['steps']>();
  for (const s of data.steps) stepsByRecipe.set(s.RecipeId, [...(stepsByRecipe.get(s.RecipeId) ?? []), s]);

  const recipes = data.recipes.map((r) => mapRecipe(r, ingByRecipe.get(r.Id) ?? [], stepsByRecipe.get(r.Id) ?? [], notes));
  // Recipes can reference a category name that was deleted (legacy stored the name, not an id).
  for (const r of recipes) {
    if (r.categoryName && !categories.has(r.categoryName.toLowerCase())) {
      categories.set(r.categoryName.toLowerCase(), { legacyId: null, name: r.categoryName, icon: r.legacyCategoryIcon && ICON.test(r.legacyCategoryIcon) ? r.legacyCategoryIcon : 'cookie' });
      notes.push({ level: 'info', entity: 'category', legacyId: r.categoryName, message: 'Kategori fandtes kun på opskrifter — oprettet' });
    }
  }
  return { categories: [...categories.values()], recipes, notes };
}

export function legacyRoleToHousehold(role: string | null): 'admin' | 'member' {
  return role === 'Administrator' ? 'admin' : 'member';
}
