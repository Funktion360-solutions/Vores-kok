import { parseIngredientLine } from '@vores-kok/domain';
import { emptyRecipe, recipeInputSchema, type RecipePayload } from '@vores-kok/validation';

export const aiDraftKey = (householdId: string) => `ai-recipe-draft:${householdId}`;
const clean = (line: string) => line.replace(/^#{1,6}\s*/, '').replace(/\*\*/g, '').trim();
const separator = (line: string) => !line || /^[-*_]{3,}$/.test(line);

export function parseAiRecipe(answer: string, householdId: string): RecipePayload {
  const lines = answer.replace(/\\([.*-])/g, '$1').split(/\r?\n/).map((line) => line.trim());
  const ingredientsAt = lines.findIndex((line) => /^ingredienser\b/i.test(clean(line)));
  let stepsAt = lines.findIndex((line, i) => i > ingredientsAt && /^(fremgangsmåde|tilberedning)\b/i.test(clean(line)));
  if (stepsAt < 0) stepsAt = lines.findIndex((line, i) => i > ingredientsAt && /^trin\s+1\b/i.test(clean(line)));
  if (ingredientsAt < 1 || stepsAt <= ingredientsAt) throw new Error('Svaret skal indeholde en titel, Ingredienser og Fremgangsmåde. Bed assistenten skrive en fuld opskrift.');
  const before = lines.slice(0, ingredientsAt).filter((line) => !separator(line));
  const titleLine = [...before].reverse().find((line) => /^(#{1,6}\s|\*\*|nyt ai-forslag\s*:)/i.test(line)) ?? before[0] ?? '';
  const title = clean(titleLine).replace(/^nyt ai-forslag\s*:\s*/i, '');
  const ingredientLines: string[] = [];
  for (const line of lines.slice(ingredientsAt + 1, stepsAt)) {
    if (separator(line)) continue;
    if (/^(udstyr|noter|tips)\b/i.test(clean(line))) break;
    ingredientLines.push(line.replace(/^[-•*]\s*/, ''));
  }
  const ingredients = ingredientLines.map((line) => {
    const parsed = parseIngredientLine(line);
    return { name: parsed.name, quantity: parsed.quantity, quantity_max: parsed.quantityMax,
      unit: parsed.unit, preparation: parsed.preparation, original_text: parsed.originalText,
      is_optional: parsed.isOptional, is_scalable: true };
  });
  const steps: { body: string }[] = [];
  const grouped = lines.slice(stepsAt).some((line) => /^trin\s+\d+\b/i.test(clean(line)));
  for (const raw of lines.slice(/^trin\s+1\b/i.test(clean(lines[stepsAt]!)) ? stepsAt : stepsAt + 1)) {
    const line = clean(raw);
    if (separator(line)) continue;
    if (/^(tip(?:s)?\s*:|opbevaring\b|variationer\b|god fornøjelse\b|hvis du vil\b|vil du have\b)/i.test(line)) break;
    const heading = line.match(/^trin\s+\d+\s*[:.)-]?\s*(.*)$/i);
    const numbered = line.match(/^\d+[.)]\s+(.+)$/);
    if (heading) steps.push({ body: heading[1] || line });
    else if (numbered && !grouped) steps.push({ body: numbered[1]! });
    else if (steps.length) steps[steps.length - 1]!.body += `\n${line}`;
  }
  if (!ingredients.length || !steps.length) throw new Error('Ingredienser eller nummererede trin mangler. Bed assistenten skrive en fuld opskrift.');
  return recipeInputSchema.parse({ ...emptyRecipe(householdId), title, ingredients, steps,
    source_type: 'text', source_name: 'AI-genereret — Vores Kok AI', source_text: answer,
    notes: 'AI-genereret udkast. Kontrollér mængder, portioner, tider og fremgangsmåde før gemning.' });
}
