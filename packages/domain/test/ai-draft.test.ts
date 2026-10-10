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

it('handles descriptive headings and keeps paragraphs with their step', () => {
  const draft = parseAiRecipe('Her kommer opskriften.\n\n**Italienske boller**\n---\n### Ingredienser (ca. 12 boller)\n- 500 g mel\n---\n### Udstyr du skal bruge:\n- En skål\n## Fremgangsmåde\n**1. Bland dejen**\nHæld vandet i.\n\nRør grundigt.\n**2. Bag bollerne**\nBag til gyldne.\n---\nGod fornøjelse!', household);
  expect(draft.title).toBe('Italienske boller');
  expect(draft.ingredients).toHaveLength(1);
  expect(draft.steps).toHaveLength(2);
  expect(draft.steps[0]?.body).toContain('Rør grundigt.');
  expect(draft.steps[1]?.body).not.toContain('God fornøjelse');
});
it('keeps substeps and readiness signs inside numbered sections', () => {
  const draft = parseAiRecipe('**Boller**\nIngredienser:\n- 500 g mel\n### Trin 1: Bland\n1. Hæld vand i.\n2. Tilsæt mel.\n\n**Tegn på færdig:** Ingen tørre klumper.\n### Trin 2: Bag\n1. Bag gyldne.', household);
  expect(draft.steps).toHaveLength(2);
  expect(draft.steps[0]?.body).toContain('Tegn på færdig');
});
