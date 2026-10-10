import { parseIngredientLine } from '@vores-kok/domain';
import { emptyRecipe, recipeInputSchema } from '@vores-kok/validation';
import type { ImportedRecipe } from '../../../../packages/validation/src/import';
export function importToDraft(recipe: ImportedRecipe, householdId: string, source: { name: string; url?: string; text: string; file?: boolean }) {
  return recipeInputSchema.parse({ ...emptyRecipe(householdId), title: recipe.title, description: recipe.description,
    servings: recipe.servings, yield_unit: recipe.yield_unit, prep_minutes: recipe.prep_minutes,
    cook_minutes: recipe.cook_minutes, total_minutes: recipe.total_minutes,
    notes: [recipe.notes, ...recipe.warnings.map(w => `Kontrollér: ${w}`)].filter(Boolean).join('\n'),
    source_type: source.url ? 'url' : source.file ? (/\.pdf$/i.test(source.name) ? 'pdf' : 'image') : 'text', source_name: source.name,
    source_url: source.url ?? null, source_text: source.text,
    ingredients: recipe.ingredients.map(line => { const p = parseIngredientLine(line); return { name: p.name,
      quantity: p.quantity, quantity_max: p.quantityMax, unit: p.unit, preparation: p.preparation,
      original_text: p.originalText, is_optional: p.isOptional, is_scalable: true }; }),
    steps: recipe.steps.map(body => ({ body })),
  });
}
