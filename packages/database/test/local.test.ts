import type { RecipeDocument } from '@vores-kok/validation';
import { describe, expect, it } from 'vitest';
import { documentToSummary, filterRecipeDocuments } from '../src/local';

const base: RecipeDocument = {
  id: '1', household_id: 'h', title: 'Drømmekage', description: null, category_id: 'c1', category: { id: 'c1', name: 'Kager', icon: 'cake' },
  cuisine: null, meal_types: ['baking'], servings: 12, yield_unit: null, prep_minutes: 20, cook_minutes: 40, total_minutes: null,
  difficulty: 'easy', notes: null, source_type: 'manual', source_name: null, source_url: null, source_text: null,
  origin_person_id: null, origin_person: null, origin_text: null, origin_year: null, origin_year_approx: true,
  legacy_id: null, legacy_author: 'Mor', legacy_last_modified: null, archived_at: null, version: 1, created_by: null, created_by_name: null,
  updated_by: null, updated_by_name: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-02T00:00:00Z',
  ingredients: [{ id: 'i1', position: 0, section: null, quantity: 100, quantity_max: null, unit: 'g', unit_code: 'g', name: 'Kokos', preparation: null, original_text: null, is_optional: false, is_scalable: true }],
  steps: [], tags: [{ id: 't1', name: 'Kaffebord' }], media: [], stories: [], is_favorite: true, notes_personal: [], version_count: 0,
};
const rug: RecipeDocument = { ...base, id: '2', title: 'Rugbrød', category_id: 'c2', category: { id: 'c2', name: 'Brød', icon: 'bread' }, meal_types: [], difficulty: 'hard',
  prep_minutes: 20, cook_minutes: 70, total_minutes: 1440, is_favorite: false, tags: [], origin_text: 'Mormor',
  ingredients: [{ ...base.ingredients[0]!, id: 'i2', name: 'rugmel' }, { ...base.ingredients[0]!, id: 'i3', name: 'kærnemælk' }], updated_at: '2026-03-01T00:00:00Z' };
const archived: RecipeDocument = { ...base, id: '3', title: 'Gammel kage', archived_at: '2026-01-01T00:00:00Z' };
const docs = [rug, base, archived];

describe('filterRecipeDocuments', () => {
  it('sorts alphabetically in Danish and hides archived', () => {
    expect(filterRecipeDocuments(docs).map((d) => d.title)).toEqual(['Drømmekage', 'Rugbrød']);
    expect(filterRecipeDocuments(docs, { archived: true })).toHaveLength(3);
  });
  it('searches title, ingredients and origin', () => {
    expect(filterRecipeDocuments(docs, { q: 'kokos' }).map((d) => d.id)).toEqual(['1']);
    expect(filterRecipeDocuments(docs, { q: 'mormor' }).map((d) => d.id)).toEqual(['2']);
    expect(filterRecipeDocuments(docs, { q: 'DRØM' }).map((d) => d.id)).toEqual(['1']);
  });
  it('applies filters with AND semantics', () => {
    expect(filterRecipeDocuments(docs, { ingredients: ['rugmel', 'Kærnemælk'] }).map((d) => d.id)).toEqual(['2']);
    expect(filterRecipeDocuments(docs, { ingredients: ['rugmel', 'kokos'] })).toEqual([]);
    expect(filterRecipeDocuments(docs, { favorites: true }).map((d) => d.id)).toEqual(['1']);
    expect(filterRecipeDocuments(docs, { maxTime: 100 }).map((d) => d.id)).toEqual(['1']);
    expect(filterRecipeDocuments(docs, { family: true }).map((d) => d.id)).toEqual(['2']);
    expect(filterRecipeDocuments(docs, { tag: ['t1'] }).map((d) => d.id)).toEqual(['1']);
    expect(filterRecipeDocuments(docs, { difficulty: ['hard'], category: ['c2'] }).map((d) => d.id)).toEqual(['2']);
  });
  it('builds summaries', () => {
    expect(documentToSummary(base)).toMatchObject({ id: '1', category_name: 'Kager', is_favorite: true, cover_path: null });
  });
});
