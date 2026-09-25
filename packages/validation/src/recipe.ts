import { DIFFICULTIES, MEAL_TYPES, MEDIA_KINDS, SOURCE_TYPES } from '@vores-kok/domain';
import { z } from 'zod';

/** Empty strings from forms become null. */
const emptyToNull = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v);

const optText = (max: number) => z.preprocess(emptyToNull, z.string().trim().max(max).nullable()).optional();
const optInt = (min: number, max: number) =>
  z.preprocess((v) => (v === '' || v === undefined ? null : typeof v === 'string' ? Number(v) : v),
    z.number().int().min(min).max(max).nullable()).optional();
const optQuantity = z.preprocess(
  (v) => (v === '' || v === undefined ? null : typeof v === 'string' ? Number(v.replace(',', '.')) : v),
  z.number().positive().max(1_000_000).nullable(),
).optional();
const optUuid = z.preprocess(emptyToNull, z.uuid().nullable()).optional();

export const ingredientInputSchema = z
  .object({
    id: optUuid,
    section: optText(120),
    quantity: optQuantity,
    quantity_max: optQuantity,
    unit: optText(40),
    unit_code: optText(20),
    name: z.string().trim().min(1, 'Ingrediensen mangler et navn').max(200),
    preparation: optText(200),
    original_text: optText(500),
    is_optional: z.boolean().default(false),
    is_scalable: z.boolean().default(true),
  })
  .refine((i) => i.quantity_max == null || (i.quantity != null && i.quantity_max >= i.quantity), {
    message: 'Maks. mængde skal være større end mængden',
    path: ['quantity_max'],
  });
export type IngredientInput = z.input<typeof ingredientInputSchema>;

export const stepInputSchema = z.object({
  id: optUuid,
  section: optText(120),
  body: z.string().trim().min(1, 'Trinnet er tomt').max(5000),
  timer_seconds: optInt(1, 172_800),
});
export type StepInput = z.input<typeof stepInputSchema>;

const httpUrl = z.preprocess(
  emptyToNull,
  z.string().trim().max(2000).regex(/^https?:\/\//i, 'Linket skal starte med http:// eller https://').nullable(),
).optional();

/** Payload for public.save_recipe. */
export const recipeInputSchema = z.object({
  id: optUuid,
  household_id: z.uuid(),
  expected_version: z.number().int().positive().nullable().optional(),
  title: z.string().trim().min(1, 'Opskriften skal have en titel').max(200),
  description: optText(4000),
  category_id: optUuid,
  cuisine: optText(80),
  meal_types: z.array(z.enum(MEAL_TYPES)).default([]),
  servings: optInt(1, 1000),
  yield_unit: optText(40),
  prep_minutes: optInt(0, 20_160),
  cook_minutes: optInt(0, 20_160),
  total_minutes: optInt(0, 40_320),
  difficulty: z.preprocess(emptyToNull, z.enum(DIFFICULTIES).nullable()).optional(),
  notes: optText(20_000),
  source_type: z.enum(SOURCE_TYPES).optional(),
  source_name: optText(200),
  source_url: httpUrl,
  source_text: optText(100_000),
  origin_person_id: optUuid,
  origin_text: optText(300),
  origin_year: optInt(1500, 2200),
  origin_year_approx: z.boolean().default(true),
  ingredients: z.array(ingredientInputSchema).max(300).default([]),
  steps: z.array(stepInputSchema).max(200).default([]),
  tags: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
});
export type RecipeInput = z.input<typeof recipeInputSchema>;
export type RecipePayload = z.output<typeof recipeInputSchema>;

// ─── Documents returned by get_recipe (validated at the boundary) ────────────
const nullableString = z.string().nullable();
const nullableNumber = z.coerce.number().nullable();

export const ingredientSchema = z.object({
  id: z.string(),
  position: z.number(),
  section: nullableString,
  quantity: nullableNumber,
  quantity_max: nullableNumber,
  unit: nullableString,
  unit_code: nullableString,
  name: z.string(),
  preparation: nullableString,
  original_text: nullableString,
  is_optional: z.boolean(),
  is_scalable: z.boolean(),
});
export type RecipeIngredient = z.infer<typeof ingredientSchema>;

export const stepSchema = z.object({
  id: z.string(),
  position: z.number(),
  section: nullableString,
  body: z.string(),
  timer_seconds: z.number().nullable(),
});
export type RecipeStep = z.infer<typeof stepSchema>;

export const mediaSchema = z.object({
  id: z.string(),
  kind: z.enum(MEDIA_KINDS),
  storage_path: z.string(),
  mime_type: z.string(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  caption: nullableString,
  approx_year: z.number().nullable(),
  is_cover: z.boolean(),
  position: z.number(),
  story_id: nullableString,
  created_at: z.string(),
});
export type RecipeMedia = z.infer<typeof mediaSchema>;

export const storySchema = z.object({
  id: z.string(),
  title: nullableString,
  body: z.string(),
  person_id: nullableString,
  person_name: nullableString,
  told_by: nullableString,
  approx_year: z.number().nullable(),
  historical_context: nullableString,
  position: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type RecipeStory = z.infer<typeof storySchema>;

export const noteSchema = z.object({
  id: z.string(),
  body: z.string(),
  visibility: z.enum(['private', 'household']),
  user_id: z.string(),
  author_name: nullableString,
  created_at: z.string(),
  updated_at: z.string(),
});
export type RecipeNote = z.infer<typeof noteSchema>;

export const recipeDocumentSchema = z.object({
  id: z.string(),
  household_id: z.string(),
  title: z.string(),
  description: nullableString,
  category_id: nullableString,
  category: z.object({ id: z.string(), name: z.string(), icon: z.string() }).nullable(),
  cuisine: nullableString,
  meal_types: z.array(z.string()),
  servings: z.number().nullable(),
  yield_unit: nullableString,
  prep_minutes: z.number().nullable(),
  cook_minutes: z.number().nullable(),
  total_minutes: z.number().nullable(),
  difficulty: z.enum(DIFFICULTIES).nullable(),
  notes: nullableString,
  source_type: z.enum(SOURCE_TYPES),
  source_name: nullableString,
  source_url: nullableString,
  source_text: nullableString,
  origin_person_id: nullableString,
  origin_person: z
    .object({ id: z.string(), name: z.string(), relation: nullableString, birth_year: z.number().nullable(), death_year: z.number().nullable() })
    .nullable(),
  origin_text: nullableString,
  origin_year: z.number().nullable(),
  origin_year_approx: z.boolean(),
  legacy_id: z.number().nullable(),
  legacy_author: nullableString,
  legacy_last_modified: nullableString,
  archived_at: nullableString,
  version: z.number(),
  created_by: nullableString,
  created_by_name: nullableString,
  updated_by: nullableString,
  updated_by_name: nullableString,
  created_at: z.string(),
  updated_at: z.string(),
  ingredients: z.array(ingredientSchema),
  steps: z.array(stepSchema),
  tags: z.array(z.object({ id: z.string(), name: z.string() })),
  media: z.array(mediaSchema),
  stories: z.array(storySchema),
  is_favorite: z.boolean(),
  notes_personal: z.array(noteSchema),
  version_count: z.number(),
});
export type RecipeDocument = z.infer<typeof recipeDocumentSchema>;

/** A blank, fully-typed recipe for "new recipe" forms. */
export function emptyRecipe(householdId: string): RecipePayload {
  return { ...recipeInputSchema.parse({ household_id: householdId, title: 'x' }), title: '' };
}

/** Converts a stored document back into an editable, fully-typed payload. */
export function documentToInput(doc: RecipeDocument): RecipePayload {
  return {
    id: doc.id,
    household_id: doc.household_id,
    expected_version: doc.version,
    title: doc.title,
    description: doc.description,
    category_id: doc.category_id,
    cuisine: doc.cuisine,
    meal_types: doc.meal_types.filter((m): m is (typeof MEAL_TYPES)[number] => (MEAL_TYPES as readonly string[]).includes(m)),
    servings: doc.servings,
    yield_unit: doc.yield_unit,
    prep_minutes: doc.prep_minutes,
    cook_minutes: doc.cook_minutes,
    total_minutes: doc.total_minutes,
    difficulty: doc.difficulty,
    notes: doc.notes,
    source_type: doc.source_type,
    source_name: doc.source_name,
    source_url: doc.source_url,
    origin_person_id: doc.origin_person_id,
    origin_text: doc.origin_text,
    origin_year: doc.origin_year,
    origin_year_approx: doc.origin_year_approx,
    ingredients: doc.ingredients.map((i) => ({
      id: i.id,
      section: i.section,
      quantity: i.quantity,
      quantity_max: i.quantity_max,
      unit: i.unit,
      unit_code: i.unit_code,
      name: i.name,
      preparation: i.preparation,
      original_text: i.original_text,
      is_optional: i.is_optional,
      is_scalable: i.is_scalable,
    })),
    steps: doc.steps.map((s) => ({ id: s.id, section: s.section, body: s.body, timer_seconds: s.timer_seconds })),
    tags: doc.tags.map((t) => t.name),
  };
}
