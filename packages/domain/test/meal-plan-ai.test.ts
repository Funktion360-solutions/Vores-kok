import { expect, it } from 'vitest';
import { mealPlanRequestSchema, validateMealPlanResult } from '../../validation/src/meal-plan-ai';
const id = '11111111-1111-4111-8111-111111111111';
const dates = ['2026-10-12', '2026-10-13'];
const suggestion = (date: string, recipe_id = id) => ({ date, recipe_id, reason: 'Hurtig aftensmad' });
it('rejects impossible dates, duplicates and invalid portions', () => {
  const input = { householdId: id, dates, servings: 2, wishes: '' };
  expect(mealPlanRequestSchema.safeParse(input).success).toBe(true);
  expect(mealPlanRequestSchema.safeParse({ ...input, dates: ['2026-02-30'] }).success).toBe(false);
  expect(mealPlanRequestSchema.safeParse({ ...input, dates: [dates[0], dates[0]] }).success).toBe(false);
  expect(mealPlanRequestSchema.safeParse({ ...input, servings: 0 }).success).toBe(false);
});
it('requires exactly one approved household recipe per requested date', () => {
  const output = { suggestions: dates.map(d => suggestion(d)), warnings: ['Kogebogen er lille'] };
  expect(validateMealPlanResult(output, dates, [id])).toEqual(output);
  expect(() => validateMealPlanResult({ ...output, suggestions: [suggestion(dates[0]!)] }, dates, [id])).toThrow();
  expect(() => validateMealPlanResult({ ...output, suggestions: [suggestion(dates[0]!), suggestion(dates[0]!)] }, dates, [id])).toThrow();
  expect(() => validateMealPlanResult(output, dates, [])).toThrow();
});
