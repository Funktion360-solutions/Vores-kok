/**
 * Parsing and formatting of recipe quantities in Danish conventions:
 * decimal comma, unicode vulgar fractions ("2½"), ascii fractions ("1 1/2"),
 * and ranges ("2-3", "2–3").
 */

const VULGAR: Record<string, number> = {
  '½': 1 / 2, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 1 / 4, '¾': 3 / 4,
  '⅕': 1 / 5, '⅖': 2 / 5, '⅗': 3 / 5, '⅘': 4 / 5, '⅙': 1 / 6, '⅚': 5 / 6,
  '⅛': 1 / 8, '⅜': 3 / 8, '⅝': 5 / 8, '⅞': 7 / 8,
};
const VULGAR_CHARS = Object.keys(VULGAR).join('');

export interface ParsedQuantity {
  quantity: number;
  quantityMax: number | null;
  approximate: boolean;
}

/** A single number token: "2", "2,5", "2.5", "½", "2½", "1/2", "1 1/2". */
const NUMBER_SRC = `(?:\\d+\\s+\\d+\\/\\d+|\\d+\\/\\d+|\\d+(?:[.,]\\d+)?\\s?[${VULGAR_CHARS}]?|[${VULGAR_CHARS}])`;
export const QUANTITY_PATTERN = new RegExp(
  `^(ca\\.?\\s+|cirka\\s+|~\\s*)?(${NUMBER_SRC})(?:\\s*(?:-|–|—|til)\\s*(${NUMBER_SRC}))?`,
  'i',
);

export function parseNumberToken(token: string): number | null {
  const t = token.trim();
  if (!t) return null;
  let m = /^(\d+)\s+(\d+)\/(\d+)$/.exec(t);
  if (m) return Number(m[1]) + Number(m[2]) / Number(m[3]) || null;
  m = /^(\d+)\/(\d+)$/.exec(t);
  if (m) return Number(m[2]) === 0 ? null : Number(m[1]) / Number(m[2]);
  m = new RegExp(`^(\\d+(?:[.,]\\d+)?)?\\s?([${VULGAR_CHARS}])?$`).exec(t);
  if (m && (m[1] || m[2])) {
    const whole = m[1] ? Number(m[1].replace(',', '.')) : 0;
    const frac = m[2] ? (VULGAR[m[2]] ?? 0) : 0;
    const v = whole + frac;
    return Number.isFinite(v) && v > 0 ? v : null;
  }
  return null;
}

/** Parses the quantity at the start of `text`. Returns the rest of the text too. */
export function parseLeadingQuantity(text: string): { parsed: ParsedQuantity | null; rest: string } {
  const src = text.trim();
  const m = QUANTITY_PATTERN.exec(src);
  if (!m) return { parsed: null, rest: src };
  const q = parseNumberToken(m[2] ?? '');
  if (q == null) return { parsed: null, rest: src };
  let max: number | null = null;
  if (m[3]) {
    const q2 = parseNumberToken(m[3]);
    if (q2 != null && q2 >= q) max = q2;
  }
  return {
    parsed: { quantity: q, quantityMax: max, approximate: Boolean(m[1]) },
    rest: src.slice(m[0].length).trim(),
  };
}

/** Parses a free-form amount string (legacy "Amount" field). */
export function parseQuantity(text: string | null | undefined): ParsedQuantity | null {
  if (text == null) return null;
  const { parsed, rest } = parseLeadingQuantity(text);
  if (!parsed || rest.length > 0) return null;
  return parsed;
}

const FRACTION_GLYPHS: Array<[number, string]> = [
  [1 / 4, '¼'], [1 / 3, '⅓'], [1 / 2, '½'], [2 / 3, '⅔'], [3 / 4, '¾'],
];

export interface FormatQuantityOptions {
  /** Use ½, ¼, ¾, ⅓, ⅔ glyphs when the value is close to one. Default true. */
  fractions?: boolean;
  /** Max decimals when not using a fraction. Default 2. */
  maxDecimals?: number;
}

/** Danish number formatting: 2.5 → "2½", 1.25 → "1¼", 0.3 → "0,3", 1250 → "1250". */
export function formatQuantity(value: number, opts: FormatQuantityOptions = {}): string {
  const { fractions = true, maxDecimals = 2 } = opts;
  if (!Number.isFinite(value)) return '';
  const whole = Math.floor(value + 1e-9);
  const frac = value - whole;
  if (fractions && frac > 0.01) {
    for (const [f, glyph] of FRACTION_GLYPHS) {
      if (Math.abs(frac - f) < 0.02) return whole > 0 ? `${whole}${glyph}` : glyph;
    }
  }
  const rounded = Number(value.toFixed(maxDecimals));
  return String(rounded).replace('.', ',');
}

export function formatQuantityRange(q: number | null, qMax: number | null, opts?: FormatQuantityOptions): string {
  if (q == null) return '';
  if (qMax != null && qMax > q) return `${formatQuantity(q, opts)}–${formatQuantity(qMax, opts)}`;
  return formatQuantity(q, opts);
}
