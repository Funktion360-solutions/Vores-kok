import { describe, expect, it } from 'vitest';
import { fieldErrors, parseRecipeFilters, filtersToSearchParams, recipeInputSchema, signUpSchema } from '../src';

const H = '11111111-1111-4111-8111-111111111111';

describe('recipeInputSchema', () => {
  it('normalizes form strings', () => {
    const r = recipeInputSchema.parse({
      household_id: H,
      title: '  Drømmekage ',
      servings: '12',
      prep_minutes: '',
      difficulty: '',
      ingredients: [{ name: 'mælk', quantity: '2,5', unit: 'dl', unit_code: 'dl' }],
      steps: [{ body: 'Pisk' }],
    });
    expect(r.title).toBe('Drømmekage');
    expect(r.servings).toBe(12);
    expect(r.prep_minutes).toBeNull();
    expect(r.difficulty).toBeNull();
    expect(r.ingredients[0]?.quantity).toBe(2.5);
    expect(r.ingredients[0]?.is_scalable).toBe(true);
  });

  it('rejects bad input with Danish messages', () => {
    const res = recipeInputSchema.safeParse({
      household_id: H,
      title: ' ',
      source_url: 'javascript:alert(1)',
      ingredients: [{ name: 'x', quantity: 3, quantity_max: 1 }],
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      const e = fieldErrors(res.error);
      expect(e.title).toMatch(/titel/);
      expect(e.source_url).toMatch(/http/);
      expect(e['ingredients.0.quantity_max']).toBeDefined();
    }
  });
});

describe('filters', () => {
  it('round-trips through search params and drops garbage', () => {
    const f = parseRecipeFilters({ q: 'kage', difficulty: 'easy,bogus', favorites: '1', maxTime: 'abc', category: 'not-a-uuid' });
    expect(f.q).toBe('kage');
    expect(f.difficulty).toBeUndefined();
    expect(f.maxTime).toBeUndefined();
    expect(f.favorites).toBe(true);
    const g = parseRecipeFilters({ difficulty: 'easy,hard', ingredients: 'mel,æg' });
    expect(filtersToSearchParams(g).toString()).toBe('difficulty=easy%2Chard&ingredients=mel%2C%C3%A6g');
  });
});

describe('auth', () => {
  it('requires a decent password', () => {
    expect(signUpSchema.safeParse({ displayName: 'A', email: 'a@b.dk', password: 'short' }).success).toBe(false);
    expect(signUpSchema.safeParse({ displayName: 'A', email: 'A@B.dk', password: 'long enough pw' }).success).toBe(true);
  });
});
