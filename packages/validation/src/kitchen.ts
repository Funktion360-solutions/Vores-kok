import { MEAL_SLOTS } from '@vores-kok/domain';
import { z } from 'zod';

const emptyToNull = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v);
const optText = (max: number) => z.preprocess(emptyToNull, z.string().trim().max(max).nullable()).optional();
const optNumber = z.preprocess(
  (v) => (v === '' || v === undefined ? null : typeof v === 'string' ? Number(v.replace(',', '.')) : v),
  z.number().positive().max(1_000_000).nullable(),
).optional();
const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ugyldig dato');
const optDate = z.preprocess(emptyToNull, dateKey.nullable()).optional();

export const planEntrySchema = z
  .object({
    id: z.uuid().optional(),
    household_id: z.uuid(),
    plan_date: dateKey,
    slot: z.enum(MEAL_SLOTS).default('dinner'),
    recipe_id: z.preprocess(emptyToNull, z.uuid().nullable()).optional(),
    title: optText(200),
    servings: z.preprocess((v) => (v === '' || v == null ? null : Number(v)), z.number().int().min(1).max(1000).nullable()).optional(),
    notes: optText(2000),
  })
  .refine((e) => e.recipe_id || e.title, { message: 'Vælg en opskrift eller skriv en ret', path: ['title'] });
export type PlanEntryInput = z.input<typeof planEntrySchema>;

export const shoppingListSchema = z.object({ household_id: z.uuid(), name: z.string().trim().min(1, 'Giv listen et navn').max(100) });

export const pantryItemSchema = z.object({
  id: z.uuid().optional(),
  household_id: z.uuid(),
  location_id: z.uuid(),
  name: z.string().trim().min(1, 'Skriv hvad det er').max(200),
  quantity: optNumber,
  unit: optText(40),
  unit_code: optText(20),
  best_before: optDate,
  opened_on: optDate,
  notes: optText(1000),
});
export type PantryItemInput = z.input<typeof pantryItemSchema>;

export const pantryLocationSchema = z.object({
  id: z.uuid().optional(),
  household_id: z.uuid(),
  name: z.string().trim().min(1, 'Giv stedet et navn').max(60),
  kind: z.enum(['fridge', 'freezer', 'cupboard', 'pantry', 'spices', 'other']).default('other'),
});
