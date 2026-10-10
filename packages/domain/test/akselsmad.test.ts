import { expect, it } from 'vitest';
import {
  emptyRecipe,
  filterRecipes,
  slugify,
  totalTime,
  type PublicRecipe,
} from '../../../apps/akselsmad/src/lib/model';
it('makes Danish recipe addresses without punctuation', () => {
  expect(slugify('Boller med frø & blåbær')).toBe('boller-med-froe-blaabaer');
});
it('uses total time including rest rather than just cooking time', () => {
  expect(
    totalTime({ ...emptyRecipe, prep_minutes: 10, cook_minutes: 20, total_minutes: 180 }),
  ).toBe(180);
});
it('combines ingredient search, category, duration and difficulty', () => {
  const row = {
    id: 'one',
    slug: 'boller',
    published_revision: 1,
    published_at: '2026-10-10',
    visible: true,
    content: {
      ...emptyRecipe,
      title: 'Boller',
      category: 'Boller',
      difficulty: 'medium',
      total_minutes: 180,
      ingredients: [{ name: 'Manitoba', quantity: 400, unit: 'g' }],
    },
  } as PublicRecipe;
  expect(filterRecipes([row], 'manitoba', 'Boller', 0, 'medium')).toEqual([row]);
  expect(filterRecipes([row], 'manitoba', 'Boller', 60, 'medium')).toEqual([]);
  expect(filterRecipes([row], 'manitoba', 'Pasta', 0, '')).toEqual([]);
  expect(filterRecipes([row], 'manitoba', 'Boller', 0, 'easy')).toEqual([]);
});
