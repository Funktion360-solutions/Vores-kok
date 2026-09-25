import { formatQuantityRange, parseIngredientLine } from '@vores-kok/domain';
import type { RecipeDocument, RecipeInput } from '@vores-kok/validation';

type Existing = RecipeDocument['ingredients'][number];

/** Renders an ingredient back to one editable line. */
export function ingredientToLine(i: Pick<Existing, 'quantity' | 'quantity_max' | 'unit' | 'name' | 'preparation' | 'original_text'>): string {
  if (i.quantity == null && i.original_text) return i.original_text;
  const qty = i.quantity != null ? formatQuantityRange(i.quantity, i.quantity_max) : '';
  return [qty, i.unit ?? '', i.name].filter(Boolean).join(' ') + (i.preparation ? `, ${i.preparation}` : '');
}

/** Parses the ingredient text area; unchanged lines keep their id and original text. */
export function linesToIngredients(text: string, existing: Existing[]): NonNullable<RecipeInput['ingredients']> {
  const byLine = new Map(existing.map((e) => [ingredientToLine(e), e]));
  const used = new Set<string>();
  let section: string | null = null;
  const out: NonNullable<RecipeInput['ingredients']> = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (/:$/.test(line) && !/\d/.test(line)) { section = line.slice(0, -1).trim() || null; continue; }
    const prev = byLine.get(line);
    if (prev && !used.has(prev.id)) {
      used.add(prev.id);
      out.push({ ...prev, section });
      continue;
    }
    const p = parseIngredientLine(line);
    out.push({ section, quantity: p.quantity, quantity_max: p.quantityMax, unit: p.unit, unit_code: p.unitCode, name: p.name, preparation: p.preparation, original_text: p.originalText, is_optional: p.isOptional, is_scalable: true });
  }
  return out;
}

export function ingredientsToText(ings: Existing[]): string {
  let section: string | null = null;
  const lines: string[] = [];
  for (const i of ings) {
    if (i.section !== section) { section = i.section; if (section) lines.push(`${section}:`); }
    lines.push(ingredientToLine(i));
  }
  return lines.join('\n');
}

