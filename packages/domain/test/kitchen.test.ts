import { describe, expect, it } from 'vitest';
import {
  addDays, aggregateShoppingLines, categorizeIngredient, detectTimers, expiryState, formatExpiry, formatShoppingAmount, formatTimer,
  formatWeekLabel, ingredientsInStep, isoWeek, mergeIntoList, startOfWeek, subtractPantry, weekDays,
} from '../src';

describe('shopping aggregation', () => {
  it('combines compatible units (spec example)', () => {
    const [p] = aggregateShoppingLines([
      { name: 'kartofler', quantity: 500, unit: 'g', unitCode: 'g', sourceRecipeIds: ['a'] },
      { name: 'Kartofler', quantity: 750, unit: 'g', unitCode: 'g', sourceRecipeIds: ['b'] },
    ]);
    expect(formatShoppingAmount(p!)).toBe('1¼ kg');
    expect(p!.sourceRecipeIds).toEqual(['a', 'b']);
    expect(p!.category).toBe('produce');
  });
  it('merges singular/plural and mixed metric units', () => {
    const out = aggregateShoppingLines([
      { name: 'æble', quantity: 2, unit: 'stk', unitCode: 'stk' },
      { name: 'æbler', quantity: 3, unit: 'stk', unitCode: 'stk' },
      { name: 'mælk', quantity: 2, unit: 'dl', unitCode: 'dl' },
      { name: 'mælk', quantity: 1, unit: 'l', unitCode: 'l' },
      { name: 'salt', quantity: 1, unit: 'tsk', unitCode: 'tsk' },
      { name: 'salt', quantity: 2, unit: 'tsk', unitCode: 'tsk' },
    ]);
    expect(out.map((l) => [l.name, formatShoppingAmount(l)])).toEqual([['æble', '5 stk'], ['mælk', '1,2 l'], ['salt', '1 spsk']]);
  });
  it('does not merge incompatible units', () => {
    const [t] = aggregateShoppingLines([
      { name: 'hakkede tomater', quantity: 400, unit: 'g', unitCode: 'g' },
      { name: 'hakkede tomater', quantity: 1, unit: 'dåse', unitCode: 'dåse' },
    ]);
    expect(formatShoppingAmount(t!)).toBe('400 g + 1 dåse');
    expect(t!.category).toBe('dry');
  });
  it('keeps items without quantity', () => {
    expect(aggregateShoppingLines([{ name: 'salt og peber', quantity: null, unit: null, unitCode: null }])[0]).toMatchObject({ quantity: null });
  });
  it('merges into existing unchecked items but never touches checked ones', () => {
    const res = mergeIntoList(
      [
        { id: 'x', name: 'kartofler', quantity: 500, unit: 'g', unit_code: 'g', checked: false, note: null, source_recipe_ids: ['a'] },
        { id: 'y', name: 'mælk', quantity: 1, unit: 'l', unit_code: 'l', checked: true, note: null, source_recipe_ids: [] },
      ],
      [{ name: 'kartofler', quantity: 750, unit: 'g', unitCode: 'g', sourceRecipeIds: ['b'] }, { name: 'mælk', quantity: 5, unit: 'dl', unitCode: 'dl' }],
    );
    expect(res[0]).toMatchObject({ id: 'x', quantity: 1.25, unit_code: 'kg', source_recipe_ids: ['a', 'b'] });
    expect(res[1]).toMatchObject({ name: 'mælk', quantity: 5, unit_code: 'dl' });
    expect(res[1]!.id).toBeUndefined();
  });
  it('subtracts pantry stock', () => {
    const { lines, covered } = subtractPantry(
      [{ name: 'mælk', quantity: 1, unit: 'l', unitCode: 'l' }, { name: 'salt', quantity: 1, unit: 'tsk', unitCode: 'tsk' }, { name: 'hvedemel', quantity: 1, unit: 'kg', unitCode: 'kg' }],
      [{ name: 'Mælk', quantity: 5, unit: 'dl', unit_code: 'dl' }, { name: 'salt', quantity: null, unit: null, unit_code: null }],
    );
    expect(covered).toEqual(['salt']);
    expect(lines.map((l) => [l.name, formatShoppingAmount({ quantity: l.quantity, unit: l.unit })])).toEqual([['mælk', '5 dl'], ['hvedemel', '1 kg']]);
  });
  it('categorises Danish ingredients', () => {
    expect(categorizeIngredient('Hakket oksekød 8-12%')).toBe('meat');
    expect(categorizeIngredient('piskefløde')).toBe('dairy');
    expect(categorizeIngredient('hvedemel')).toBe('dry');
    expect(categorizeIngredient('frisk basilikum')).toBe('produce');
    expect(categorizeIngredient('stødt kardemomme')).toBe('spices');
    expect(categorizeIngredient('æg')).toBe('dairy');
    expect(categorizeIngredient('noget helt ukendt')).toBe('other');
  });
});

describe('calendar', () => {
  it('handles Danish weeks', () => {
    expect(startOfWeek('2026-09-25')).toBe('2026-09-21');
    expect(startOfWeek('2026-09-27')).toBe('2026-09-21');
    expect(isoWeek('2026-09-21')).toBe(39);
    expect(isoWeek('2027-01-01')).toBe(53);
    expect(weekDays('2026-09-28')).toHaveLength(7);
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(formatWeekLabel('2026-09-28')).toBe('Uge 40 · 28. sep. – 4. okt.');
  });
  it('describes expiry', () => {
    expect(expiryState('2026-09-24', '2026-09-25')).toBe('expired');
    expect(expiryState('2026-09-27', '2026-09-25')).toBe('soon');
    expect(expiryState(null)).toBe('none');
    expect(formatExpiry('2026-09-26', '2026-09-25')).toBe('Udløber i morgen');
  });
});

describe('cooking', () => {
  it('detects timers in Danish step text', () => {
    expect(detectTimers('Bag ved 200°C i 25-30 minutter til gyldenbrun.').map((t) => t.seconds)).toEqual([1800]);
    expect(detectTimers('Lad hæve tildækket i 1 time.').map((t) => t.seconds)).toEqual([3600]);
    expect(detectTimers('Kog i 10 min og lad hvile 5 min.').map((t) => t.seconds)).toEqual([600, 300]);
    expect(detectTimers('Lad dejen hæve i en halv time').map((t) => t.seconds)).toEqual([1800]);
    expect(detectTimers('Pisk æg og sukker meget luftigt – mindst 10 min.').map((t) => t.seconds)).toEqual([600]);
    expect(detectTimers('Tilsæt 200 g mel.')).toEqual([]);
  });
  it('formats timers', () => {
    expect(formatTimer(605)).toBe('10:05');
    expect(formatTimer(3725)).toBe('1:02:05');
  });
  it('finds ingredients mentioned in a step', () => {
    const ings = [{ name: 'hvedemel' }, { name: 'gær' }, { name: 'lunkent vand' }, { name: 'sukker' }, { name: 'brun farin' }, { name: 'æg' }];
    expect(ingredientsInStep('Opløs gæren i lunkent vand med sukker.', ings).map((i) => i.name)).toEqual(['gær', 'lunkent vand', 'sukker']);
    expect(ingredientsInStep('Smelt smør, tilsæt brun farin.', ings).map((i) => i.name)).toEqual(['brun farin']);
    expect(ingredientsInStep('Pisk æg og sukker luftigt.', ings).map((i) => i.name)).toEqual(['sukker', 'æg']);
    expect(ingredientsInStep('Brun kødet i 10 minutter.', [{ name: 'hakket oksekød' }, { name: 'løg' }]).map((i) => i.name)).toEqual(['hakket oksekød']);
    expect(ingredientsInStep('Pisk æggene.', [{ name: 'æg' }, { name: 'mel' }]).map((i) => i.name)).toEqual(['æg']);
    expect(ingredientsInStep('Tilsæt løgene.', [{ name: 'hvidløg' }, { name: 'løg' }]).map((i) => i.name)).toEqual(['løg']);
    expect(ingredientsInStep('Tilsæt hvidløg og løg.', [{ name: 'hvidløg' }, { name: 'løg' }]).map((i) => i.name)).toEqual(['hvidløg', 'løg']);
  });
});
