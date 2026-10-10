import { z } from 'zod';
export const importedRecipeSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(4000).nullable(),
  servings: z.number().int().min(1).max(1000).nullable(),
  yield_unit: z.string().max(40).nullable(),
  prep_minutes: z.number().int().min(0).max(20160).nullable(),
  cook_minutes: z.number().int().min(0).max(20160).nullable(),
  total_minutes: z.number().int().min(0).max(40320).nullable(),
  ingredients: z.array(z.string().min(1).max(1000)).min(1).max(100),
  steps: z.array(z.string().min(1).max(8000)).min(1).max(100),
  notes: z.string().max(12000).nullable(),
  warnings: z.array(z.string().max(1000)).max(30),
  original_text: z.string().max(60000),
}).strict();
export const importResultSchema = z.object({ recipes: z.array(importedRecipeSchema).min(1).max(10) }).strict();
export type ImportedRecipe = z.infer<typeof importedRecipeSchema>;
