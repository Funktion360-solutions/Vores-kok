/**
 * Deterministic serving scaling. No AI involved.
 *
 * Scales a quantity by a factor and re-expresses it in a unit that reads
 * naturally in a Danish kitchen: 1500 g → 1,5 kg, 4,5 tsk → 1½ spsk,
 * 12 dl → 1,2 l, 1,33 æg → 1½ stk. Imperial units stay imperial.
 */
import { formatQuantityRange } from './quantity';
import { getUnit, unitLabel, type UnitDefinition } from './units';

export interface QuantityInput {
  quantity: number | null;
  quantityMax?: number | null;
  unit?: string | null;
  unitCode?: string | null;
  isScalable?: boolean;
}

export interface ScaledQuantity {
  quantity: number | null;
  quantityMax: number | null;
  unitCode: string | null;
  /** Unit text to display (label of the chosen unit, or the original free text). */
  unit: string | null;
  /** True if the value was changed from the original. */
  scaled: boolean;
}

export function scaleFactor(fromServings: number | null | undefined, toServings: number | null | undefined): number {
  if (!fromServings || !toServings || fromServings <= 0 || toServings <= 0) return 1;
  return toServings / fromServings;
}

export function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/** Rounds to a precision that is sensible for the magnitude. */
export function niceRound(value: number): number {
  if (value <= 0) return value;
  if (value < 1) return Math.max(roundTo(value, 0.25), 0.25);
  if (value < 10) return roundTo(value, 0.5) || 0.5;
  if (value < 100) return Math.round(value);
  if (value < 1000) return roundTo(value, 5);
  return roundTo(value, 10);
}

const SPOON_CODES = new Set(['tsk', 'spsk']);
const METRIC_VOLUME = new Set(['ml', 'cl', 'dl', 'l']);
const METRIC_MASS = new Set(['mg', 'g', 'kg']);

interface Choice {
  code: string;
  value: number;
}

function chooseMass(grams: number, original: UnitDefinition): Choice {
  if (!METRIC_MASS.has(original.code)) {
    const v = grams / (original.toBase ?? 1);
    return { code: original.code, value: v < 10 ? roundTo(v, 0.25) || 0.25 : Math.round(v) };
  }
  if (grams >= 1000) return { code: 'kg', value: Math.max(roundTo(grams / 1000, 0.05), 0.05) };
  if (grams < 1) return { code: 'mg', value: Math.round(grams * 1000) };
  if (grams < 10) return { code: 'g', value: roundTo(grams, 0.5) || 0.5 };
  if (grams < 100) return { code: 'g', value: Math.round(grams) };
  return { code: 'g', value: roundTo(grams, 5) };
}

function chooseVolume(ml: number, original: UnitDefinition): Choice {
  if (SPOON_CODES.has(original.code)) {
    if (ml < 15 - 0.01) return { code: 'tsk', value: Math.max(roundTo(ml / 5, 0.25), 0.25) };
    if (ml < 90) return { code: 'spsk', value: roundTo(ml / 15, 0.5) };
    return { code: 'dl', value: roundTo(ml / 100, 0.25) };
  }
  if (METRIC_VOLUME.has(original.code)) {
    if (ml >= 1000) return { code: 'l', value: roundTo(ml / 1000, 0.05) };
    if (original.code === 'ml' && ml < 100) return { code: 'ml', value: Math.max(Math.round(ml), 1) };
    if (original.code === 'cl' && ml < 100) return { code: 'cl', value: roundTo(ml / 10, 0.5) || 0.5 };
    if (ml < 25) {
      // Very small metric volumes read better as spoons.
      return ml < 15 ? { code: 'tsk', value: Math.max(roundTo(ml / 5, 0.25), 0.25) } : { code: 'spsk', value: roundTo(ml / 15, 0.5) };
    }
    return { code: 'dl', value: roundTo(ml / 100, 0.25) };
  }
  const v = ml / (original.toBase ?? 1);
  return { code: original.code, value: v < 10 ? roundTo(v, 0.25) || 0.25 : Math.round(v) };
}

export function scaleQuantity(input: QuantityInput, factor: number): ScaledQuantity {
  const base: ScaledQuantity = {
    quantity: input.quantity,
    quantityMax: input.quantityMax ?? null,
    unitCode: input.unitCode ?? null,
    unit: input.unit ?? null,
    scaled: false,
  };
  if (input.quantity == null || input.isScalable === false || !Number.isFinite(factor) || factor <= 0 || Math.abs(factor - 1) < 1e-9) {
    return base;
  }
  const unit = getUnit(input.unitCode);
  const q = input.quantity * factor;
  const qMax = input.quantityMax != null ? input.quantityMax * factor : null;

  if (unit && (unit.kind === 'mass' || unit.kind === 'volume') && unit.toBase) {
    const pick = unit.kind === 'mass' ? chooseMass : chooseVolume;
    const main = pick(q * unit.toBase, unit);
    let max: number | null = null;
    if (qMax != null) {
      const target = getUnit(main.code)!;
      max = roundTo((qMax * unit.toBase) / (target.toBase ?? 1), main.value < 10 ? 0.25 : 1);
      if (max <= main.value) max = null;
    }
    const target = getUnit(main.code)!;
    return {
      quantity: main.value,
      quantityMax: max,
      unitCode: main.code,
      unit: unitLabel(target, main.value),
      scaled: true,
    };
  }

  const value = niceRound(q);
  const max = qMax != null ? niceRound(qMax) : null;
  return {
    quantity: value,
    quantityMax: max != null && max > value ? max : null,
    unitCode: input.unitCode ?? null,
    unit: unit ? unitLabel(unit, value) : (input.unit ?? null),
    scaled: true,
  };
}

/** "1¼ kg", "2–3 fed", "½ tsk", "" (no quantity). */
export function formatAmount(q: Pick<ScaledQuantity, 'quantity' | 'quantityMax' | 'unit'>): string {
  const num = formatQuantityRange(q.quantity, q.quantityMax);
  return [num, q.unit ?? ''].filter(Boolean).join(' ').trim();
}
