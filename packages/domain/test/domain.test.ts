import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  UNITS,
  assignableRoles,
  buildMediaPath,
  can,
  formatAmount,
  formatMinutes,
  formatQuantity,
  isValidMediaPath,
  normalizeIngredientName,
  parseDifficulty,
  parseIngredientLine,
  parseQuantity,
  resolveUnit,
  scaleFactor,
  scaleQuantity,
  totalMinutes,
  validateUpload,
} from '../src';

describe('parseQuantity', () => {
  it.each([
    ['2½', 2.5, null],
    ['2 ½', 2.5, null],
    ['½', 0.5, null],
    ['1/2', 0.5, null],
    ['1 1/2', 1.5, null],
    ['2,5', 2.5, null],
    ['2.5', 2.5, null],
    ['500', 500, null],
    ['2-3', 2, 3],
    ['2–3', 2, 3],
    ['1 til 2', 1, 2],
  ])('%s', (input, q, max) => {
    expect(parseQuantity(input)).toEqual({ quantity: q, quantityMax: max, approximate: false });
  });

  it('marks approximate', () => {
    expect(parseQuantity('ca. 3')).toEqual({ quantity: 3, quantityMax: null, approximate: true });
  });

  it('rejects non-numeric text', () => {
    expect(parseQuantity('en smule')).toBeNull();
    expect(parseQuantity('')).toBeNull();
    expect(parseQuantity('2 store')).toBeNull();
  });
});

describe('formatQuantity', () => {
  it('uses fractions and decimal comma', () => {
    expect(formatQuantity(2.5)).toBe('2½');
    expect(formatQuantity(0.25)).toBe('¼');
    expect(formatQuantity(1.333)).toBe('1⅓');
    expect(formatQuantity(1.2)).toBe('1,2');
    expect(formatQuantity(1250)).toBe('1250');
  });
});

describe('parseIngredientLine', () => {
  it('parses the spec example', () => {
    expect(parseIngredientLine('2½ dl hvedemel')).toMatchObject({
      quantity: 2.5, unit: 'dl', unitCode: 'dl', name: 'hvedemel', originalText: '2½ dl hvedemel',
    });
  });
  it('handles attached units, preparation and optional', () => {
    expect(parseIngredientLine('500g smør, blødt')).toMatchObject({ quantity: 500, unitCode: 'g', name: 'smør', preparation: 'blødt' });
    expect(parseIngredientLine('evt. 1 tsk. kanel')).toMatchObject({ quantity: 1, unitCode: 'tsk', name: 'kanel', isOptional: true });
    expect(parseIngredientLine('- 1-2 fed hvidløg')).toMatchObject({ quantity: 1, quantityMax: 2, unitCode: 'fed', name: 'hvidløg' });
  });
  it('keeps unknown words in the name', () => {
    expect(parseIngredientLine('2 store løg')).toMatchObject({ quantity: 2, unit: null, name: 'store løg' });
    expect(parseIngredientLine('1 æg')).toMatchObject({ quantity: 1, unit: null, name: 'æg' });
  });
  it('keeps unstructured family wording intact', () => {
    const r = parseIngredientLine('smør til formen efter mormors mave');
    expect(r).toMatchObject({ quantity: null, unit: null, name: 'smør til formen efter mormors mave' });
  });
});

describe('scaling', () => {
  it('computes factor', () => {
    expect(scaleFactor(4, 8)).toBe(2);
    expect(scaleFactor(null, 8)).toBe(1);
  });
  it('converts mass upward', () => {
    const r = scaleQuantity({ quantity: 750, unitCode: 'g', unit: 'g' }, 2);
    expect(formatAmount(r)).toBe('1½ kg');
  });
  it('500 g + 750 g style sums read as kg', () => {
    expect(formatAmount(scaleQuantity({ quantity: 625, unitCode: 'g' }, 2))).toBe('1¼ kg');
  });
  it('turns teaspoons into tablespoons', () => {
    expect(formatAmount(scaleQuantity({ quantity: 1, unitCode: 'tsk', unit: 'tsk' }, 3))).toBe('1 spsk');
    expect(formatAmount(scaleQuantity({ quantity: 1, unitCode: 'tsk', unit: 'tsk' }, 0.5))).toBe('½ tsk');
  });
  it('turns dl into l', () => {
    expect(formatAmount(scaleQuantity({ quantity: 3, unitCode: 'dl' }, 4))).toBe('1,2 l');
    expect(formatAmount(scaleQuantity({ quantity: 2.5, unitCode: 'dl' }, 0.5))).toBe('1¼ dl');
  });
  it('rounds counts to halves', () => {
    expect(formatAmount(scaleQuantity({ quantity: 1, unit: 'stk', unitCode: 'stk' }, 4 / 3))).toBe('1½ stk');
    expect(formatAmount(scaleQuantity({ quantity: 3, unit: null }, 1.5))).toBe('4½');
  });
  it('respects non-scalable and missing quantities', () => {
    expect(scaleQuantity({ quantity: 1, unitCode: 'knsp', isScalable: false }, 3).quantity).toBe(1);
    expect(scaleQuantity({ quantity: null, unit: null }, 3).quantity).toBeNull();
  });
  it('keeps free-text units', () => {
    expect(formatAmount(scaleQuantity({ quantity: 2, unit: 'kranse' }, 2))).toBe('4 kranse');
  });
  it('scales ranges', () => {
    expect(formatAmount(scaleQuantity({ quantity: 1, quantityMax: 2, unitCode: 'fed', unit: 'fed' }, 2))).toBe('2–4 fed');
  });
  it('keeps imperial units imperial', () => {
    expect(formatAmount(scaleQuantity({ quantity: 1, unitCode: 'lb' }, 2))).toBe('2 lb');
  });
});

describe('time and labels', () => {
  it('formats like legacy TotalTimeLabel', () => {
    expect(formatMinutes(45)).toBe('45 min');
    expect(formatMinutes(60)).toBe('1 t.');
    expect(formatMinutes(150)).toBe('2 t. 30 min');
    expect(formatMinutes(1440)).toBe('1 døgn');
  });
  it('computes total', () => {
    expect(totalMinutes({ prep_minutes: 20, cook_minutes: 40 })).toBe(60);
    expect(totalMinutes({ prep_minutes: 20, cook_minutes: 40, total_minutes: 1440 })).toBe(1440);
    expect(totalMinutes({})).toBeNull();
  });
  it('maps legacy difficulty', () => {
    expect(parseDifficulty('Let')).toBe('easy');
    expect(parseDifficulty('Middel')).toBe('medium');
    expect(parseDifficulty('Svær')).toBe('hard');
    expect(parseDifficulty('???')).toBeNull();
  });
  it('normalizes ingredient names like SQL', () => {
    expect(normalizeIngredientName('  Brun   Farin ')).toBe('brun farin');
  });
});

describe('units', () => {
  it('resolves aliases', () => {
    expect(resolveUnit('Tsk.')?.code).toBe('tsk');
    expect(resolveUnit('spiseske')?.code).toBe('spsk');
    expect(resolveUnit('dåser')?.code).toBe('dåse');
    expect(resolveUnit('hvedemel')).toBeUndefined();
  });

  it('matches the SQL seed in the migration', () => {
    const sql = readFileSync(fileURLToPath(new URL('../../../supabase/migrations/20260925210137_recipes.sql', import.meta.url)), 'utf8');
    const rows = [...sql.matchAll(/\(\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'(mass|volume|count|other)',\s*([\d.]+|null),/g)];
    expect(rows.length).toBe(UNITS.length);
    for (const [, code, label, plural, kind, toBase] of rows) {
      const u = UNITS.find((x) => x.code === code);
      expect(u, code).toBeDefined();
      expect(u).toMatchObject({ label, labelPlural: plural, kind, toBase: toBase === 'null' ? null : Number(toBase) });
    }
  });
});

describe('permissions', () => {
  it('matches the documented matrix', () => {
    expect(can('viewer', 'recipe.read')).toBe(true);
    expect(can('viewer', 'recipe.edit')).toBe(false);
    expect(can('viewer', 'favorite')).toBe(true);
    expect(can('member', 'recipe.edit')).toBe(true);
    expect(can('member', 'recipe.delete')).toBe(false);
    expect(can('admin', 'recipe.delete')).toBe(true);
    expect(can('admin', 'household.delete')).toBe(false);
    expect(can(null, 'recipe.read')).toBe(false);
    expect(assignableRoles('admin')).toEqual(['member', 'viewer']);
  });
});

describe('media', () => {
  const h = '11111111-1111-4111-8111-111111111111';
  const r = '22222222-2222-4222-8222-222222222222';
  const f = '33333333-3333-4333-8333-333333333333';
  it('builds valid paths', () => {
    const p = buildMediaPath(h, 'recipes', r, f, 'image/jpeg');
    expect(p).toBe(`${h}/recipes/${r}/${f}.jpg`);
    expect(isValidMediaPath(p)).toBe(true);
    expect(isValidMediaPath(`${h}/recipes/../x.jpg`)).toBe(false);
  });
  it('rejects bad ids', () => {
    expect(() => buildMediaPath('../etc', 'recipes', r, f, 'image/png')).toThrow();
  });
  it('validates uploads', () => {
    expect(validateUpload({ size: 10, type: 'text/html' })).toMatch(/Filtypen/);
    expect(validateUpload({ size: 30 * 1024 * 1024, type: 'image/jpeg' })).toMatch(/for stor/);
    expect(validateUpload({ size: 1000, type: 'image/webp' })).toBeNull();
  });
});
