import { describe, it, expect } from 'vitest';
import { parseAiRecipe } from '../../../apps/web/src/lib/ai-recipe-draft';
const household = '11111111-1111-4111-8111-111111111111';
describe('AI recipe review draft', () => {
  it('extracts a recipe and preserves provenance', () => {
    const text =
      'Nyt AI-forslag: Boller\n\nIngredienser:\n- 300 g Manitoba-mel\n- 200 ml vand\n\nFremgangsmåde:\n1. Bland dejen.\n2. Bag bollerne.\n\nGod fornøjelse!';
    const draft = parseAiRecipe(text, household);
    expect(draft.title).toBe('Boller');
    expect(draft.ingredients[0]?.quantity).toBe(300);
    expect(draft.steps).toHaveLength(2);
    expect(draft.source_text).toBe(text);
    expect(draft.source_name).toContain('AI-genereret');
    expect(draft.household_id).toBe(household);
  });
  it('rejects incomplete answers', () => {
    expect(() => parseAiRecipe('Du kan prøve pasta.', household)).toThrow();
    expect(() =>
      parseAiRecipe('Pasta\nIngredienser:\n- 200 g pasta\nFremgangsmåde:\nKog det.', household),
    ).toThrow();
  });
  it('accepts markdown and escaped markers', () => {
    const draft = parseAiRecipe(
      '## Nyt AI-forslag: Pasta\n**Ingredienser:**\n\\- 200 g pasta\n**Fremgangsmåde:**\n1\\. Kog pasta.',
      household,
    );
    expect(draft.steps[0]?.body).toBe('Kog pasta.');
  });
});
