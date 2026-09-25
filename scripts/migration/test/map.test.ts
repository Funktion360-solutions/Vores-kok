import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildFixture } from '../src/fixture';
import { readLegacy } from '../src/legacy';
import { buildPlan, mapIngredient, parseLegacyDate, type Note } from '../src/map';

const dir = mkdtempSync(join(tmpdir(), 'vk-legacy-'));
const { dbPath } = buildFixture(dir);
const data = readLegacy(dbPath);
const plan = buildPlan(data);

describe('legacy reader', () => {
  it('reads all tables', () => {
    expect(data.recipes).toHaveLength(8);
    expect(data.ingredients.length).toBe(5 + 7 + 8 + 6 + 4 + 8 + 5 + 1);
    expect(data.users.map((u) => [u.UserName, u.Role])).toEqual([['far', 'User'], ['mor', 'Administrator']]);
    expect(data.favorites).toHaveLength(3);
    expect(data.unknownColumns).toEqual({});
    expect(data.sha256).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('mapping', () => {
  it('maps the seeded recipes faithfully', () => {
    const k = plan.recipes.find((r) => r.title === 'Kanelsnegle')!;
    expect(k).toMatchObject({ prepMinutes: 45, cookMinutes: 60, servings: 16, difficulty: 'medium', legacyAuthor: 'Mor', categoryName: 'Brød & Bagværk', legacyCategoryIcon: 'croissant' });
    expect(k.ingredients.find((i) => i.name === 'mælk')).toMatchObject({ quantity: 2.5, unit: 'dl', unitCode: 'dl', originalText: '2½ dl mælk' });
    // "1 æg" stored as Unit=æg, Name=""
    expect(k.ingredients.at(-1)).toMatchObject({ quantity: 1, unit: null, name: 'æg', originalText: '1 æg' });
    expect(k.steps.map((s) => s.position)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(k.steps[0]?.body).toBe('Opløs gæren i lun mælk.');
    expect(plan.recipes.find((r) => r.title === 'Franskbrød')?.imageFile).toBe('a1b2c3d4-0000-4000-8000-000000000001.jpg');
  });

  it('keeps unusual family wording and records every interpretation', () => {
    const s = plan.recipes.find((r) => r.title === 'Farmors sovs')!;
    expect(s.ingredients.map((i) => i.name)).toEqual(['en smule kulør', 'efter smag salt og peber', 'hvedemel', 'Stegeskyen fra anden', 'fløde']);
    expect(s.ingredients[2]).toMatchObject({ quantity: 1, quantityMax: 2, unitCode: 'spsk' });
    expect(s.ingredients[4]).toMatchObject({ quantity: 0.5, unitCode: 'l' });
    expect(s).toMatchObject({ prepMinutes: null, cookMinutes: null, servings: null });
    expect(s.steps).toHaveLength(2);
    expect(s.legacyLastModified).toBe('2025-12-20T17:45:12.000Z');
    expect(plan.categories.find((c) => c.name === 'Julebag')).toMatchObject({ legacyId: null, icon: 'star' });
    expect(plan.notes.some((n) => n.entity === 'category' && n.legacyId === 'Julebag')).toBe(true);
    const blank = plan.recipes.find((r) => r.legacyId === 8)!;
    expect(blank.title).toBe('Opskrift #8');
    expect(blank.difficulty).toBeNull();
    expect(plan.notes.filter((n) => n.level === 'warning').length).toBeGreaterThanOrEqual(2);
  });

  it('skips only truly empty ingredient lines', () => {
    const notes: Note[] = [];
    expect(mapIngredient({ Id: 1, RecipeId: 1, Amount: '', Unit: '', Name: '' }, 0, notes)).toBeNull();
    expect(notes).toHaveLength(1);
  });

  it('converts Danish local timestamps', () => {
    expect(parseLegacyDate('2026-05-10 00:00:00')).toBe('2026-05-09T22:00:00.000Z');
    expect(parseLegacyDate('garbage')).toBeNull();
  });
});
