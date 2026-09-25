/**
 * Shopping-list logic: deterministic aggregation of ingredient quantities
 * across recipes, and categorisation into Danish supermarket sections.
 */
import { normalizeIngredientName } from './ingredients';
import { formatQuantity } from './quantity';
import { niceRound, roundTo } from './scaling';
import { getUnit, resolveUnit, unitLabel } from './units';

export const SHOPPING_CATEGORIES = ['produce', 'bakery', 'dairy', 'meat', 'frozen', 'dry', 'spices', 'drinks', 'household', 'other'] as const;
export type ShoppingCategory = (typeof SHOPPING_CATEGORIES)[number];

export const SHOPPING_CATEGORY_LABELS: Record<ShoppingCategory, string> = {
  produce: 'Frugt og grønt',
  bakery: 'Brød og bagværk',
  dairy: 'Mejeri og æg',
  meat: 'Kød og fisk',
  frozen: 'Frost',
  dry: 'Kolonial',
  spices: 'Krydderier',
  drinks: 'Drikkevarer',
  household: 'Husholdning',
  other: 'Andet',
};

// Order = typical walk through a Danish supermarket.
export const SHOPPING_CATEGORY_ORDER: ShoppingCategory[] = ['produce', 'bakery', 'meat', 'dairy', 'dry', 'spices', 'frozen', 'drinks', 'household', 'other'];

const KEYWORDS: Array<[ShoppingCategory, string[]]> = [
  ['spices', ['kanel', 'kardemomme', 'peber', 'salt', 'paprika', 'karry', 'spidskommen', 'oregano', 'timian', 'rosmarin', 'laurbær', 'muskat', 'vanilje', 'nellike', 'chiliflager', 'gurkemeje', 'ingefærpulver', 'bouillon', 'krydderi', 'stjerneanis', 'allehånde']],
  ['frozen', ['frosne', 'frossen', 'frost', 'is ', 'isvafler']],
  ['dairy', ['mælk', 'fløde', 'smør', 'ost', 'yoghurt', 'skyr', 'kærnemælk', 'creme fraiche', 'crème fraîche', 'æg', 'parmesan', 'mozzarella', 'feta', 'hytteost', 'kvark', 'margarine', 'mascarpone', 'ymer', 'piskefløde', 'madlavningsfløde']],
  ['meat', ['kylling', 'oksekød', 'svinekød', 'hakket', 'flæsk', 'bacon', 'skinke', 'pølse', 'fisk', 'laks', 'torsk', 'rejer', 'tun', 'lam', 'and', 'kalkun', 'medister', 'frikadelle', 'mørbrad', 'kotelet', 'steg', 'filet', 'rullepølse', 'leverpostej', 'sild', 'makrel', 'rødspætte']],
  ['bakery', ['brød', 'boller', 'rugbrød', 'franskbrød', 'tortilla', 'pitabrød', 'toast', 'baguette', 'wienerbrød', 'knækbrød']],
  ['produce', ['løg', 'hvidløg', 'kartoffel', 'kartofler', 'gulerod', 'gulerødder', 'tomat', 'agurk', 'salat', 'spinat', 'kål', 'broccoli', 'blomkål', 'porre', 'selleri', 'peberfrugt', 'squash', 'aubergine', 'champignon', 'svampe', 'æble', 'æbler', 'pære', 'banan', 'citron', 'lime', 'appelsin', 'bær', 'jordbær', 'hindbær', 'blåbær', 'persille', 'dild', 'purløg', 'basilikum', 'koriander', 'mynte', 'ingefær', 'chili', 'avocado', 'ærter', 'bønner', 'majs', 'rabarber', 'druer', 'mango', 'ananas', 'rødbede', 'pastinak', 'græskar', 'forårsløg', 'skalotteløg', 'rosenkål']],
  ['drinks', ['vin', 'øl', 'juice', 'saft', 'sodavand', 'kaffe', 'te ', 'vand ', 'rom', 'snaps']],
  ['household', ['bagepapir', 'folie', 'køkkenrulle', 'opvask', 'servietter', 'poser']],
  ['dry', ['mel', 'hvedemel', 'rugmel', 'sukker', 'farin', 'gær', 'bagepulver', 'natron', 'havregryn', 'ris', 'pasta', 'spaghetti', 'nudler', 'couscous', 'bulgur', 'linser', 'kikærter', 'olie', 'eddike', 'sennep', 'ketchup', 'mayonnaise', 'honning', 'sirup', 'chokolade', 'kakao', 'kokos', 'mandler', 'nødder', 'rosiner', 'marmelade', 'dåse', 'hakkede tomater', 'tomatpuré', 'kokosmælk', 'soja', 'makroner', 'kerner', 'maizena', 'gelatine', 'syltetøj', 'rasp', 'cornflakes', 'müsli']],
];

/** Guesses the supermarket section for an ingredient name. Deterministic, Danish-first. */
export function categorizeIngredient(name: string): ShoppingCategory {
  const n = ` ${normalizeIngredientName(name)} `;
  // Specific multi-word matches first ("hakkede tomater" is dry goods, not produce).
  for (const [cat, words] of KEYWORDS) {
    for (const w of words) if (w.includes(' ') && n.includes(` ${w.trim()} `)) return cat;
  }
  for (const [cat, words] of KEYWORDS) {
    for (const w of words) {
      const word = w.trim();
      if (n.includes(` ${word} `) || n.includes(` ${word}`) || (word.length >= 4 && n.includes(word))) return cat;
    }
  }
  return 'other';
}

export interface ShoppingLine {
  name: string;
  quantity: number | null;
  unit: string | null;
  unitCode: string | null;
  /** Recipes that contributed this line. */
  sourceRecipeIds?: string[];
}

export interface AggregatedLine extends ShoppingLine {
  key: string;
  category: ShoppingCategory;
  sourceRecipeIds: string[];
  /** Lines that could not be merged numerically (e.g. "1 dåse" + "400 g"). */
  extra: Array<{ quantity: number | null; unit: string | null }>;
}

/** Singular/plural folding so "æble" and "æbler", "kartoffel" and "kartofler" merge. */
export function ingredientKey(name: string): string {
  const n = normalizeIngredientName(name).replace(/[,.;:]+$/g, '');
  const irregular: Record<string, string> = { kartofler: 'kartoffel', gulerødder: 'gulerod', æbler: 'æble', løg: 'løg', æg: 'æg', tomater: 'tomat', citroner: 'citron', pærer: 'pære', bananer: 'banan' };
  if (irregular[n]) return irregular[n]!;
  return n;
}

type Bucket = { kind: 'mass' | 'volume'; base: number } | { kind: 'unit'; unit: string; code: string | null; qty: number } | { kind: 'none' };

function bucketOf(l: ShoppingLine): Bucket {
  const u = getUnit(l.unitCode) ?? resolveUnit(l.unit);
  if (l.quantity == null) return { kind: 'none' };
  if (u && (u.kind === 'mass' || u.kind === 'volume') && u.toBase) return { kind: u.kind, base: l.quantity * u.toBase };
  return { kind: 'unit', unit: (u?.code ?? (l.unit ?? '').trim().toLowerCase()), code: u?.code ?? null, qty: l.quantity };
}

/** Expresses a base amount (g or ml) in a natural shopping unit. */
export function baseToDisplay(kind: 'mass' | 'volume', base: number): { quantity: number; unitCode: string; unit: string } {
  if (kind === 'mass') {
    if (base >= 1000) { const q = roundTo(base / 1000, 0.05); return { quantity: q, unitCode: 'kg', unit: 'kg' }; }
    return { quantity: niceRound(base), unitCode: 'g', unit: 'g' };
  }
  if (base >= 1000) return { quantity: roundTo(base / 1000, 0.05), unitCode: 'l', unit: 'l' };
  if (base >= 50) return { quantity: roundTo(base / 100, 0.25), unitCode: 'dl', unit: 'dl' };
  if (base >= 15) { const q = roundTo(base / 15, 0.5); return { quantity: q, unitCode: 'spsk', unit: 'spsk' }; }
  const q = Math.max(roundTo(base / 5, 0.25), 0.25);
  return { quantity: q, unitCode: 'tsk', unit: 'tsk' };
}

/**
 * Combines lines for the same ingredient when their units are compatible:
 * 500 g + 750 g kartofler → 1,25 kg; 1 tsk + 2 tsk → 1 spsk; 2 stk + 1 stk → 3 stk.
 * Incompatible amounts (400 g + 1 dåse) stay on the same line as `extra`
 * instead of being converted by guesswork.
 */
export function aggregateShoppingLines(lines: ShoppingLine[]): AggregatedLine[] {
  const groups = new Map<string, { name: string; sources: Set<string>; mass: number; volume: number; units: Map<string, { code: string | null; unit: string; qty: number }>; noQty: boolean; order: number }>();
  lines.forEach((l, i) => {
    const key = ingredientKey(l.name);
    if (!key) return;
    let g = groups.get(key);
    if (!g) { g = { name: l.name.trim(), sources: new Set(), mass: 0, volume: 0, units: new Map(), noQty: false, order: i }; groups.set(key, g); }
    for (const s of l.sourceRecipeIds ?? []) g.sources.add(s);
    const b = bucketOf(l);
    if (b.kind === 'mass') g.mass += b.base;
    else if (b.kind === 'volume') g.volume += b.base;
    else if (b.kind === 'unit') {
      const cur = g.units.get(b.unit);
      if (cur) cur.qty += b.qty;
      else g.units.set(b.unit, { code: b.code, unit: b.code ? (getUnit(b.code)?.label ?? b.unit) : (l.unit ?? '').trim(), qty: b.qty });
    } else g.noQty = true;
  });

  const out: AggregatedLine[] = [];
  for (const [key, g] of [...groups.entries()].sort((a, b) => a[1].order - b[1].order)) {
    const parts: Array<{ quantity: number | null; unit: string | null; unitCode: string | null }> = [];
    if (g.mass > 0) { const d = baseToDisplay('mass', g.mass); parts.push({ quantity: d.quantity, unit: d.unit, unitCode: d.unitCode }); }
    if (g.volume > 0) { const d = baseToDisplay('volume', g.volume); parts.push({ quantity: d.quantity, unit: d.unit, unitCode: d.unitCode }); }
    for (const u of g.units.values()) {
      const def = getUnit(u.code);
      const q = Math.round(u.qty * 100) / 100;
      parts.push({ quantity: q, unit: def ? unitLabel(def, q) : u.unit || null, unitCode: u.code });
    }
    if (!parts.length) parts.push({ quantity: null, unit: null, unitCode: null });
    const [main, ...rest] = parts;
    out.push({
      key,
      name: g.name,
      quantity: main!.quantity,
      unit: main!.unit,
      unitCode: main!.unitCode,
      category: categorizeIngredient(g.name),
      sourceRecipeIds: [...g.sources],
      extra: rest.map((r) => ({ quantity: r.quantity, unit: r.unit })),
    });
  }
  return out;
}

/** Human text for an aggregated line's amount: "1¼ kg + 1 dåse". */
export function formatShoppingAmount(l: Pick<AggregatedLine, 'quantity' | 'unit'> & { extra?: AggregatedLine['extra'] }): string {
  const fmt = (q: number | null, u: string | null) => [q != null ? formatQuantity(q) : '', u ?? ''].filter(Boolean).join(' ');
  return [fmt(l.quantity, l.unit), ...(l.extra ?? []).map((e) => fmt(e.quantity, e.unit))].filter(Boolean).join(' + ');
}

export interface ExistingShoppingItem {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  unit_code: string | null;
  checked: boolean;
  note: string | null;
  source_recipe_ids: string[];
}

export interface ShoppingUpsert {
  id?: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  unit_code: string | null;
  category: ShoppingCategory;
  note: string | null;
  source_recipe_ids: string[];
}

/**
 * Merges new lines into an existing list: unchecked items for the same
 * ingredient are increased (when units are compatible); otherwise a new item
 * is added. Checked items are never modified — they were already bought.
 */
export function mergeIntoList(existing: ExistingShoppingItem[], incoming: ShoppingLine[]): ShoppingUpsert[] {
  const open = new Map(existing.filter((e) => !e.checked).map((e) => [ingredientKey(e.name), e]));
  const result: ShoppingUpsert[] = [];
  for (const line of aggregateShoppingLines(incoming)) {
    const cur = open.get(line.key);
    if (cur) {
      const merged = aggregateShoppingLines([
        { name: cur.name, quantity: cur.quantity, unit: cur.unit, unitCode: cur.unit_code },
        { name: cur.name, quantity: line.quantity, unit: line.unit, unitCode: line.unitCode },
        ...line.extra.map((x) => ({ name: cur.name, quantity: x.quantity, unit: x.unit, unitCode: null })),
      ])[0]!;
      const extraText = merged.extra.length ? merged.extra.map((e) => formatShoppingAmount({ quantity: e.quantity, unit: e.unit })).join(' + ') : null;
      result.push({
        id: cur.id, name: cur.name, quantity: merged.quantity, unit: merged.unit, unit_code: merged.unitCode,
        category: categorizeIngredient(cur.name),
        note: extraText ? `+ ${extraText}` : cur.note,
        source_recipe_ids: [...new Set([...cur.source_recipe_ids, ...line.sourceRecipeIds])],
      });
    } else {
      const extraText = line.extra.length ? line.extra.map((e) => formatShoppingAmount({ quantity: e.quantity, unit: e.unit })).join(' + ') : null;
      result.push({
        name: line.name, quantity: line.quantity, unit: line.unit, unit_code: line.unitCode, category: line.category,
        note: extraText ? `+ ${extraText}` : null, source_recipe_ids: line.sourceRecipeIds,
      });
    }
  }
  return result;
}

/** Turns an aggregated line back into plain lines (main amount + unmergeable extras). */
export function expandAggregated(l: AggregatedLine): ShoppingLine[] {
  return [
    { name: l.name, quantity: l.quantity, unit: l.unit, unitCode: l.unitCode, sourceRecipeIds: l.sourceRecipeIds },
    ...l.extra.map((e) => ({ name: l.name, quantity: e.quantity, unit: e.unit, unitCode: resolveUnit(e.unit)?.code ?? null, sourceRecipeIds: l.sourceRecipeIds })),
  ];
}

export interface PantryStock { name: string; quantity: number | null; unit: string | null; unit_code: string | null }

/**
 * Removes (or reduces) lines already covered by the pantry. Only compares
 * compatible units; a pantry item without quantity counts as "we have it".
 */
export function subtractPantry(lines: ShoppingLine[], pantry: PantryStock[]): { lines: ShoppingLine[]; covered: string[] } {
  const stock = new Map<string, PantryStock[]>();
  for (const p of pantry) stock.set(ingredientKey(p.name), [...(stock.get(ingredientKey(p.name)) ?? []), p]);
  const covered: string[] = [];
  const out: ShoppingLine[] = [];
  for (const l of aggregateShoppingLines(lines)) {
    const have = stock.get(l.key);
    if (!have?.length) { out.push(...expandAggregated(l)); continue; }
    if (have.some((h) => h.quantity == null) || l.quantity == null) { covered.push(l.name); continue; }
    const need = bucketOf(l);
    let remaining = need.kind === 'mass' || need.kind === 'volume' ? need.base : need.kind === 'unit' ? need.qty : 0;
    for (const h of have) {
      const hb = bucketOf({ name: h.name, quantity: h.quantity, unit: h.unit, unitCode: h.unit_code });
      if (need.kind === hb.kind && (need.kind === 'mass' || need.kind === 'volume')) remaining -= (hb as { base: number }).base;
      else if (need.kind === 'unit' && hb.kind === 'unit' && need.unit === hb.unit) remaining -= hb.qty;
    }
    if (remaining <= 1e-9) { covered.push(l.name); continue; }
    if (need.kind === 'mass' || need.kind === 'volume') {
      const d = baseToDisplay(need.kind, remaining);
      out.push({ name: l.name, quantity: d.quantity, unit: d.unit, unitCode: d.unitCode, sourceRecipeIds: l.sourceRecipeIds });
    } else if (need.kind === 'unit') out.push({ name: l.name, quantity: Math.round(remaining * 100) / 100, unit: l.unit, unitCode: l.unitCode, sourceRecipeIds: l.sourceRecipeIds });
    else out.push(...expandAggregated(l));
  }
  return { lines: out, covered };
}
