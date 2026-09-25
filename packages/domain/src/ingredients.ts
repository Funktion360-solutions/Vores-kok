import { parseLeadingQuantity } from './quantity';
import { resolveUnit } from './units';

export interface ParsedIngredient {
  quantity: number | null;
  quantityMax: number | null;
  /** Unit exactly as written (null if none recognised). */
  unit: string | null;
  /** Known unit code, if the unit was recognised. */
  unitCode: string | null;
  name: string;
  preparation: string | null;
  isOptional: boolean;
  approximate: boolean;
  /** The untouched input line. Always preserved. */
  originalText: string;
}

/** Mirrors SQL private.normalize_text(): lowercase, trimmed, single spaces. */
export function normalizeIngredientName(name: string | null | undefined): string {
  return (name ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

const OPTIONAL_PREFIX = /^(evt\.?|eventuelt|valgfrit:?)\s+/i;
const BULLET = /^[\s\-–•*·]+/;

/**
 * Parses a single ingredient line such as "2½ dl hvedemel", "500g smør, blødt",
 * "1-2 fed hvidløg", "evt. 1 tsk kanel" or "salt og peber".
 * Never throws; anything it cannot structure stays in `name`, and
 * `originalText` always holds the raw line.
 */
export function parseIngredientLine(line: string): ParsedIngredient {
  const originalText = line.trim();
  let text = originalText.replace(BULLET, '');
  let isOptional = false;
  if (OPTIONAL_PREFIX.test(text)) {
    isOptional = true;
    text = text.replace(OPTIONAL_PREFIX, '');
  }

  const { parsed, rest } = parseLeadingQuantity(text);
  let remainder = parsed ? rest : text;
  let unit: string | null = null;
  let unitCode: string | null = null;

  if (parsed) {
    const m = /^([^\s,()]+)(\s+|$)/.exec(remainder);
    if (m?.[1]) {
      const candidate = resolveUnit(m[1]);
      if (candidate) {
        unit = m[1].replace(/\.$/, '');
        unitCode = candidate.code;
        remainder = remainder.slice(m[0].length);
      }
    }
  }

  let name = remainder.trim();
  let preparation: string | null = null;
  const comma = name.indexOf(',');
  if (comma > 0) {
    preparation = name.slice(comma + 1).trim() || null;
    name = name.slice(0, comma).trim();
  }
  if (!name) {
    // e.g. "3 stk" with no name — keep the line rather than lose information.
    name = originalText;
  }
  if (OPTIONAL_PREFIX.test(name)) {
    isOptional = true;
    name = name.replace(OPTIONAL_PREFIX, '');
  }

  return {
    quantity: parsed?.quantity ?? null,
    quantityMax: parsed?.quantityMax ?? null,
    unit,
    unitCode,
    name,
    preparation,
    isOptional,
    approximate: parsed?.approximate ?? false,
    originalText,
  };
}
