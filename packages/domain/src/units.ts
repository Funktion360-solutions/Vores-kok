/**
 * Unit reference data. MUST stay in sync with the `public.units` seed in
 * supabase/migrations/20260925000200_recipes.sql — a unit test enforces this.
 */
export type UnitKind = 'mass' | 'volume' | 'count' | 'other';

export interface UnitDefinition {
  code: string;
  label: string;
  labelPlural: string;
  kind: UnitKind;
  /** Factor to base unit: grams for mass, millilitres for volume. */
  toBase: number | null;
  aliases: readonly string[];
}

export const UNITS: readonly UnitDefinition[] = [
  { code: 'mg', label: 'mg', labelPlural: 'mg', kind: 'mass', toBase: 0.001, aliases: ['milligram'] },
  { code: 'g', label: 'g', labelPlural: 'g', kind: 'mass', toBase: 1, aliases: ['gram', 'gr', 'gr.'] },
  { code: 'kg', label: 'kg', labelPlural: 'kg', kind: 'mass', toBase: 1000, aliases: ['kilo', 'kilogram'] },
  { code: 'ml', label: 'ml', labelPlural: 'ml', kind: 'volume', toBase: 1, aliases: ['milliliter'] },
  { code: 'cl', label: 'cl', labelPlural: 'cl', kind: 'volume', toBase: 10, aliases: ['centiliter'] },
  { code: 'dl', label: 'dl', labelPlural: 'dl', kind: 'volume', toBase: 100, aliases: ['deciliter'] },
  { code: 'l', label: 'l', labelPlural: 'l', kind: 'volume', toBase: 1000, aliases: ['liter', 'ltr'] },
  { code: 'tsk', label: 'tsk', labelPlural: 'tsk', kind: 'volume', toBase: 5, aliases: ['tsk.', 'teske', 'teskefuld', 'tl'] },
  { code: 'spsk', label: 'spsk', labelPlural: 'spsk', kind: 'volume', toBase: 15, aliases: ['spsk.', 'spiseske', 'spiseskefuld', 'sp'] },
  { code: 'knsp', label: 'knsp', labelPlural: 'knsp', kind: 'other', toBase: null, aliases: ['knsp.', 'knivspids'] },
  { code: 'stk', label: 'stk', labelPlural: 'stk', kind: 'count', toBase: null, aliases: ['stk.', 'styk', 'styk.'] },
  { code: 'fed', label: 'fed', labelPlural: 'fed', kind: 'count', toBase: null, aliases: [] },
  { code: 'skive', label: 'skive', labelPlural: 'skiver', kind: 'count', toBase: null, aliases: ['skiver'] },
  { code: 'bundt', label: 'bundt', labelPlural: 'bundter', kind: 'count', toBase: null, aliases: ['bundter', 'bdt'] },
  { code: 'dåse', label: 'dåse', labelPlural: 'dåser', kind: 'count', toBase: null, aliases: ['dåser', 'ds'] },
  { code: 'pose', label: 'pose', labelPlural: 'poser', kind: 'count', toBase: null, aliases: ['poser'] },
  { code: 'pakke', label: 'pakke', labelPlural: 'pakker', kind: 'count', toBase: null, aliases: ['pakker', 'pk'] },
  { code: 'glas', label: 'glas', labelPlural: 'glas', kind: 'count', toBase: null, aliases: [] },
  { code: 'håndfuld', label: 'håndfuld', labelPlural: 'håndfulde', kind: 'other', toBase: null, aliases: ['håndfulde'] },
  { code: 'drys', label: 'drys', labelPlural: 'drys', kind: 'other', toBase: null, aliases: [] },
  { code: 'cup', label: 'cup', labelPlural: 'cups', kind: 'volume', toBase: 240, aliases: ['cups', 'kop', 'kopper'] },
  { code: 'oz', label: 'oz', labelPlural: 'oz', kind: 'mass', toBase: 28.3495, aliases: ['ounce', 'ounces'] },
  { code: 'lb', label: 'lb', labelPlural: 'lb', kind: 'mass', toBase: 453.592, aliases: ['pound', 'pounds', 'lbs'] },
];

const byCode = new Map(UNITS.map((u) => [u.code, u]));
const byAlias = new Map<string, UnitDefinition>();
for (const u of UNITS) {
  byAlias.set(u.code, u);
  byAlias.set(u.labelPlural.toLowerCase(), u);
  for (const a of u.aliases) byAlias.set(a.toLowerCase(), u);
}

export function getUnit(code: string | null | undefined): UnitDefinition | undefined {
  return code ? byCode.get(code) : undefined;
}

/** Resolves free text ("Tsk.", "spiseske", "gram") to a known unit, if any. */
export function resolveUnit(text: string | null | undefined): UnitDefinition | undefined {
  if (!text) return undefined;
  const key = text.trim().toLowerCase();
  return byAlias.get(key) ?? byAlias.get(key.replace(/\.$/, ''));
}

export function unitLabel(unit: UnitDefinition, quantity: number | null | undefined): string {
  return quantity != null && quantity > 1 ? unit.labelPlural : unit.label;
}
