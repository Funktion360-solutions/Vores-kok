/** Cook-mode helpers: timers found in step text and step-specific ingredients. */
import { normalizeIngredientName } from './ingredients';

export interface DetectedTimer {
  /** Seconds; for ranges ("25-30 min") the upper bound. */
  seconds: number;
  label: string;
}

const NUM = '(\\d+(?:[.,]\\d+)?|½|en|et|to|tre|fire|fem|ti|tyve|halv)';
const WORDS: Record<string, number> = { en: 1, et: 1, to: 2, tre: 3, fire: 4, fem: 5, ti: 10, tyve: 20, halv: 0.5, '½': 0.5 };
const toNum = (s: string) => WORDS[s.toLowerCase()] ?? Number(s.replace(',', '.'));

const PATTERN = new RegExp(
  `(?:ca\\.?\\s*)?${NUM}(?:\\s*(?:-|–|til)\\s*${NUM})?\\s*(timer|time|t\\.|min(?:utter|ut)?\\.?|sek(?:under|und)?\\.?)(?![a-zæøå])`,
  'gi',
);

/**
 * Finds durations in a step ("Bag ved 200°C i 25-30 minutter", "Lad hæve 1 time").
 * Deterministic; returns each distinct duration once.
 */
export function detectTimers(text: string): DetectedTimer[] {
  const out: DetectedTimer[] = [];
  const seen = new Set<number>();
  for (const m of text.matchAll(PATTERN)) {
    const a = toNum(m[1]!);
    const b = m[2] ? toNum(m[2]) : null;
    const unit = m[3]!.toLowerCase();
    const value = b != null && b > a ? b : a;
    if (!Number.isFinite(value) || value <= 0) continue;
    const mult = unit.startsWith('t') ? 3600 : unit.startsWith('s') ? 1 : 60;
    const seconds = Math.round(value * mult);
    if (seconds < 5 || seconds > 48 * 3600 || seen.has(seconds)) continue;
    seen.add(seconds);
    out.push({ seconds, label: m[0].trim().replace(/^ca\.?\s*/i, '') });
  }
  return out;
}

export function formatTimer(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(h ? 2 : 1, '0');
  const ss = String(sec).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Strips Danish definite/plural endings: "kødet" → "kød", "æggene" → "æg", "løgene" → "løg". */
function stemWord(w: string): string {
  let s = w.length > 4 ? w.replace(/(ernes|erne|ene|ens|ets|en|et|er|es)$/u, '') : w;
  s = s.replace(/([bdfgklmnprst])\1$/u, '$1');
  return s.length >= 2 ? s : w;
}

/**
 * Ingredients mentioned in a step. Two passes: direct mentions (full name or
 * its stem, longest names first so "brun farin" wins over "farin"), then
 * compound head nouns ("kødet" → "hakket oksekød") for step words not
 * already explained by a direct mention ("løgene" → "løg", not "hvidløg").
 */
export function ingredientsInStep<T extends { name: string }>(step: string, ingredients: T[]): T[] {
  const clean = (v: string) => normalizeIngredientName(v).replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  const text = ` ${clean(step)} `;
  const stepStems = text.trim().split(' ').filter((w) => w.length >= 2).map(stemWord);
  const hits = new Set<T>();
  const usedStems = new Set<string>();
  let remaining = text; // text with already-matched phrases blanked out
  const sorted = [...ingredients].sort((a, b) => b.name.length - a.name.length);

  for (const ing of sorted) {
    const n = clean(ing.name);
    if (n.length < 2) continue;
    const stem = n.length > 5 ? n.replace(/(erne|ene|er|en|et|e|r)$/u, '') : n;
    const head = n.split(' ').pop() ?? n;
    const direct = remaining.includes(` ${n} `) || remaining.includes(` ${n}`) || (stem.length >= 4 && remaining.includes(` ${stem}`))
      || remaining.trim().split(' ').map(stemWord).includes(head);
    if (direct) {
      hits.add(ing);
      remaining = remaining.split(` ${n}`).join(' '.repeat(n.length + 1));
      usedStems.add(head);
      for (const w of stepStems) if (n.includes(w)) usedStems.add(w);
    }
  }
  for (const ing of sorted) {
    if (hits.has(ing)) continue;
    const head = clean(ing.name).split(' ').pop() ?? '';
    const w = stepStems.find((x) => x.length >= 3 && head.length > x.length && head.endsWith(x) && !usedStems.has(x));
    if (w) { hits.add(ing); usedStems.add(w); }
  }
  // Preserve the recipe's ingredient order.
  return ingredients.filter((i) => hits.has(i));
}
