import { z } from 'zod';
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => { const d = new Date(`${value}T12:00:00Z`); return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value; }, 'Ugyldig dato');
export const mealPlanRequestSchema = z.object({ householdId: z.uuid(), dates: z.array(date).min(1).max(7).refine(d => new Set(d).size === d.length), servings: z.number().int().min(1).max(1000), wishes: z.string().trim().max(2000) }).strict();
export const mealPlanResultSchema = z.object({ suggestions: z.array(z.object({ date: z.string(), recipe_id: z.uuid(), reason: z.string().min(1).max(1000) }).strict()).min(1).max(7), warnings: z.array(z.string().max(1000)).max(20) }).strict();
export type MealPlanResult = z.infer<typeof mealPlanResultSchema>;
export function validateMealPlanResult(value: unknown, dates: string[], recipeIds: string[]): MealPlanResult {
  const result = mealPlanResultSchema.parse(value);
  const allowed = new Set(recipeIds);
  if (result.suggestions.length !== dates.length || new Set(result.suggestions.map(s => s.date)).size !== dates.length || result.suggestions.some(s => !dates.includes(s.date) || !allowed.has(s.recipe_id))) throw new Error('AI-forslaget indeholder ugyldige datoer eller opskrifter.');
  return result;
}
