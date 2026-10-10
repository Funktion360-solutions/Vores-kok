import { parseIngredientLine } from '@vores-kok/domain';
import { emptyRecipe, recipeInputSchema, type RecipePayload } from '@vores-kok/validation';

export const aiDraftKey = (householdId: string) => `ai-recipe-draft:${householdId}`;

/** Conservative extraction: unsupported answers stay in the conversation. */
export function parseAiRecipe(answer: string, householdId: string): RecipePayload {
  const lines = answer
    .replace(/\\([.*-])/g, '$1')
    .split(/\r?\n/)
    .map((line) => line.trim());
  const clean = (line: string) =>
    line
      .replace(/^#{1,6}\s*/, '')
      .replace(/\*\*/g, '')
      .trim();
  const ingredientsAt = lines.findIndex((line) => /^ingredienser\s*:/i.test(clean(line)));
  const stepsAt = lines.findIndex((line) => /^(fremgangsmåde|tilberedning)\s*:/i.test(clean(line)));
  if (ingredientsAt < 1 || stepsAt <= ingredientsAt)
    throw new Error(
      'Svaret skal indeholde en titel, Ingredienser og Fremgangsmåde. Bed assistenten skrive en fuld opskrift.',
    );
  const title = clean(lines.find((line) => line.trim()) ?? '').replace(
    /^nyt ai-forslag\s*:\s*/i,
    '',
  );
  const ingredients = lines
    .slice(ingredientsAt + 1, stepsAt)
    .filter(Boolean)
    .map((line) => {
      const parsed = parseIngredientLine(line.replace(/^[-•*]\s*/, ''));
      return {
        name: parsed.name,
        quantity: parsed.quantity,
        quantity_max: parsed.quantityMax,
        unit: parsed.unit,
        preparation: parsed.preparation,
        original_text: parsed.originalText,
        is_optional: parsed.isOptional,
        is_scalable: true,
      };
    });
  const steps: { body: string }[] = [];
  for (const line of lines.slice(stepsAt + 1)) {
    const match = line.match(/^\d+[.)]\s+(.+)$/);
    if (match) steps.push({ body: match[1]! });
    else if (line && steps.length && !line.includes('?')) {
      // Paragraphs after the numbered method are commentary, not extra steps.
      if (!lines[lines.indexOf(line) - 1]) break;
      steps[steps.length - 1]!.body += ` ${line}`;
    }
  }
  if (!ingredients.length || !steps.length)
    throw new Error(
      'Ingredienser eller nummererede trin mangler. Bed assistenten skrive en fuld opskrift.',
    );
  return recipeInputSchema.parse({
    ...emptyRecipe(householdId),
    title,
    ingredients,
    steps,
    source_type: 'text',
    source_name: 'AI-genereret — Vores Kok AI',
    source_text: answer,
    notes:
      'AI-genereret udkast. Kontrollér mængder, portioner, tider og fremgangsmåde før gemning.',
  });
}
