import { DIFFICULTIES, HOUSEHOLD_ROLES, MEAL_TYPES, MEDIA_KINDS } from '@vores-kok/domain';
import { z } from 'zod';

const emptyToNull = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v);
const optText = (max: number) => z.preprocess(emptyToNull, z.string().trim().max(max).nullable()).optional();
const optYear = z.preprocess(
  (v) => (v === '' || v === undefined ? null : typeof v === 'string' ? Number(v) : v),
  z.number().int().min(1500).max(2200).nullable(),
).optional();

export const emailSchema = z.string().trim().toLowerCase().email('Ugyldig e-mailadresse').max(320);
export const passwordSchema = z.string().min(10, 'Adgangskoden skal være mindst 10 tegn').max(200);

export const signInSchema = z.object({ email: emailSchema, password: z.string().min(1, 'Skriv din adgangskode') });
export const signUpSchema = z.object({
  displayName: z.string().trim().min(1, 'Skriv dit navn').max(80),
  email: emailSchema,
  password: passwordSchema,
});

export const householdNameSchema = z.string().trim().min(1, 'Giv husstanden et navn').max(100);

export const inviteSchema = z.object({
  household_id: z.uuid(),
  role: z.enum(HOUSEHOLD_ROLES).refine((r) => r !== 'owner', 'Ejere kan ikke inviteres'),
  email: z.preprocess(emptyToNull, emailSchema.nullable()).optional(),
});

export const inviteTokenSchema = z.string().trim().min(20).max(100).regex(/^[A-Za-z0-9_-]+$/, 'Ugyldig invitationskode');

export const profileSchema = z.object({ display_name: z.string().trim().min(1).max(80) });

export const categorySchema = z.object({
  id: z.uuid().optional(),
  household_id: z.uuid(),
  name: z.string().trim().min(1, 'Kategorien skal have et navn').max(100),
  icon: z.string().regex(/^[a-z0-9-]{1,40}$/).default('cookie'),
});

export const personSchema = z
  .object({
    id: z.uuid().optional(),
    household_id: z.uuid(),
    name: z.string().trim().min(1, 'Skriv et navn').max(120),
    relation: optText(120),
    birth_year: optYear,
    death_year: optYear,
    bio: optText(10_000),
  })
  .refine((p) => p.birth_year == null || p.death_year == null || p.death_year >= p.birth_year, {
    message: 'Dødsår kan ikke være før fødselsår',
    path: ['death_year'],
  });

export const storyInputSchema = z.object({
  id: z.uuid().optional(),
  recipe_id: z.uuid(),
  household_id: z.uuid(),
  title: optText(200),
  body: z.string().trim().min(1, 'Historien er tom').max(50_000),
  person_id: z.preprocess(emptyToNull, z.uuid().nullable()).optional(),
  told_by: optText(120),
  approx_year: optYear,
  historical_context: optText(10_000),
});

export const noteInputSchema = z.object({
  body: z.string().trim().min(1, 'Noten er tom').max(10_000),
  visibility: z.enum(['private', 'household']).default('private'),
});

export const mediaMetaSchema = z.object({
  kind: z.enum(MEDIA_KINDS).default('photo'),
  caption: optText(1000),
  approx_year: optYear,
});

/** Recipe list filters, parsed from URL search params or app state. */
export const recipeFiltersSchema = z.object({
  q: z.string().trim().max(200).optional().catch(undefined),
  category: z.array(z.uuid()).optional().catch(undefined),
  tag: z.array(z.uuid()).optional().catch(undefined),
  difficulty: z.array(z.enum(DIFFICULTIES)).optional().catch(undefined),
  meal: z.array(z.enum(MEAL_TYPES)).optional().catch(undefined),
  maxTime: z.coerce.number().int().positive().max(40_320).optional().catch(undefined),
  maxPrep: z.coerce.number().int().positive().max(20_160).optional().catch(undefined),
  favorites: z.coerce.boolean().optional().catch(undefined),
  family: z.coerce.boolean().optional().catch(undefined),
  person: z.uuid().optional().catch(undefined),
  ingredients: z.array(z.string().trim().min(1).max(60)).max(10).optional().catch(undefined),
  archived: z.coerce.boolean().optional().catch(undefined),
  sort: z.enum(['relevance', 'title', 'updated', 'time']).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(1000).optional().catch(undefined),
});
export type RecipeFilters = z.infer<typeof recipeFiltersSchema>;

/** Parses URLSearchParams-like records ("?difficulty=easy&difficulty=hard"). */
export function parseRecipeFilters(params: Record<string, string | string[] | undefined>): RecipeFilters {
  const arr = (v: string | string[] | undefined) => (v == null ? undefined : (Array.isArray(v) ? v : v.split(',')).filter(Boolean));
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;
  return recipeFiltersSchema.parse({
    q: one(params.q),
    category: arr(params.category),
    tag: arr(params.tag),
    difficulty: arr(params.difficulty),
    meal: arr(params.meal),
    maxTime: one(params.maxTime),
    maxPrep: one(params.maxPrep),
    favorites: one(params.favorites) === '1' ? true : undefined,
    family: one(params.family) === '1' ? true : undefined,
    person: one(params.person),
    ingredients: arr(params.ingredients),
    archived: one(params.archived) === '1' ? true : undefined,
    sort: one(params.sort),
    page: one(params.page),
  });
}

export function filtersToSearchParams(f: RecipeFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q) p.set('q', f.q);
  for (const [k, v] of [['category', f.category], ['tag', f.tag], ['difficulty', f.difficulty], ['meal', f.meal], ['ingredients', f.ingredients]] as const) {
    if (v?.length) p.set(k, v.join(','));
  }
  if (f.maxTime) p.set('maxTime', String(f.maxTime));
  if (f.maxPrep) p.set('maxPrep', String(f.maxPrep));
  if (f.favorites) p.set('favorites', '1');
  if (f.family) p.set('family', '1');
  if (f.person) p.set('person', f.person);
  if (f.archived) p.set('archived', '1');
  if (f.sort) p.set('sort', f.sort);
  if (f.page && f.page > 1) p.set('page', String(f.page));
  return p;
}

export function activeFilterCount(f: RecipeFilters): number {
  return [f.category?.length, f.tag?.length, f.difficulty?.length, f.meal?.length, f.ingredients?.length, f.maxTime, f.maxPrep, f.favorites, f.family, f.person, f.archived]
    .filter(Boolean).length;
}
