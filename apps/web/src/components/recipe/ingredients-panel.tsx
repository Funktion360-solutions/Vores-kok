'use client';
import { formatAmount, formatYield, scaleFactor, scaleQuantity } from '@vores-kok/domain';
import type { RecipeIngredient } from '@vores-kok/validation';
import { Minus, Plus, RotateCcw } from 'lucide-react';
import { useMemo, useState } from 'react';

function groupBySection(items: RecipeIngredient[]) {
  const groups: Array<{ section: string | null; items: RecipeIngredient[] }> = [];
  for (const i of items) {
    const last = groups[groups.length - 1];
    if (last && last.section === i.section) last.items.push(i);
    else groups.push({ section: i.section, items: [i] });
  }
  return groups;
}

/** Ingredient list with deterministic serving scaling (packages/domain). */
export function IngredientsPanel({ ingredients, servings, yieldUnit }: { ingredients: RecipeIngredient[]; servings: number | null; yieldUnit: string | null }) {
  const [target, setTarget] = useState(servings ?? 0);
  const factor = scaleFactor(servings, target);
  const groups = useMemo(() => groupBySection(ingredients), [ingredients]);
  const step = servings && servings >= 12 ? Math.max(1, Math.round(servings / 4)) : 1;
  const presets = servings && servings <= 12 ? [2, 4, 6, 8].filter((n) => n !== servings) : [];

  return (
    <section aria-labelledby="ingredients-heading">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 id="ingredients-heading" className="text-2xl font-semibold">Ingredienser</h2>
        {servings ? (
          <div className="no-print flex items-center gap-1 rounded-full border border-line bg-paper p-1">
            <button type="button" onClick={() => setTarget((t) => Math.max(1, t - step))} className="flex size-10 items-center justify-center rounded-full hover:bg-sand" aria-label="Færre portioner"><Minus className="size-4" /></button>
            <output aria-live="polite" className="min-w-24 text-center text-sm font-medium">{formatYield(target, yieldUnit)}</output>
            <button type="button" onClick={() => setTarget((t) => Math.min(1000, t + step))} className="flex size-10 items-center justify-center rounded-full hover:bg-sand" aria-label="Flere portioner"><Plus className="size-4" /></button>
          </div>
        ) : null}
      </div>
      {servings && (presets.length || target !== servings) ? (
        <div className="no-print mb-4 flex flex-wrap gap-2">
          {presets.map((n) => (
            <button key={n} type="button" onClick={() => setTarget(n)} aria-pressed={target === n}
              className={`min-h-9 rounded-full border px-3 text-sm ${target === n ? 'border-brand bg-brand-soft text-brand-dark' : 'border-line hover:bg-sand'}`}>{n} {yieldUnit ?? 'pers.'}</button>
          ))}
          {target !== servings ? (
            <button type="button" onClick={() => setTarget(servings)} className="inline-flex min-h-9 items-center gap-1 rounded-full px-3 text-sm text-ink-soft hover:bg-sand">
              <RotateCcw className="size-3.5" aria-hidden /> Original ({servings})
            </button>
          ) : null}
        </div>
      ) : null}
      {ingredients.length === 0 ? <p className="text-ink-muted">Ingen ingredienser endnu.</p> : null}
      {groups.map((g, gi) => (
        <div key={gi} className="mb-4">
          {g.section ? <h3 className="mb-2 font-display text-lg font-semibold text-ink-soft">{g.section}</h3> : null}
          <ul className="divide-y divide-line/70">
            {g.items.map((i) => {
              const s = scaleQuantity({ quantity: i.quantity, quantityMax: i.quantity_max, unit: i.unit, unitCode: i.unit_code, isScalable: i.is_scalable }, factor);
              const amount = formatAmount(s);
              return (
                <li key={i.id} className="grid grid-cols-[6.5rem_1fr] gap-3 py-2.5 text-[15px] leading-snug">
                  <span className={`text-right font-semibold tabular-nums ${s.scaled ? 'text-brand-dark' : 'text-ink'}`}>{amount}</span>
                  <span>
                    {i.name}
                    {i.preparation ? <span className="text-ink-soft">, {i.preparation}</span> : null}
                    {i.is_optional ? <span className="ml-1.5 text-xs text-ink-muted">(valgfri)</span> : null}
                    {!i.quantity && i.original_text && i.original_text !== i.name ? <span className="block text-xs text-ink-muted">“{i.original_text}”</span> : null}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {factor !== 1 ? <p className="no-print text-xs text-ink-muted">Mængderne er omregnet automatisk og afrundet til praktiske mål.</p> : null}
    </section>
  );
}
