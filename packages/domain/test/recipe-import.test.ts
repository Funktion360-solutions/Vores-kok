import { it, expect } from 'vitest';
import { isPublicIPv4, extractRecipeSource, mapStructuredRecipes } from '../../../apps/web/src/lib/recipe-url';
import { importToDraft } from '../../../apps/web/src/lib/import-draft';
import { importResultSchema } from '../../validation/src/import';
it('rejects private, metadata, loopback and non IPv4 addresses', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.1.1', '192.168.1.1', '169.254.169.254', '100.64.1.1', '224.1.2.3', '::1', '::ffff:127.0.0.1']) expect(isPublicIPv4(ip)).toBe(false);
  expect(isPublicIPv4('8.8.8.8')).toBe(true);
});
it('maps multiple JSON-LD recipes without AI and preserves quantities and provenance', () => {
  const html = `<script type="application/ld+json">${JSON.stringify({ '@graph': [{ '@type': 'Recipe', name: 'Boller', recipeIngredient: ['2½ dl vand'], recipeInstructions: [{ '@type': 'HowToStep', text: 'Bland dejen' }], recipeYield: '12 boller', prepTime: 'PT15M' }, { '@type': 'Recipe', name: 'Pasta', recipeIngredient: ['200 g pasta'], recipeInstructions: 'Kog pasta' }] })}</script>`;
  const source = extractRecipeSource(html);
  expect(source.structured).toBe(true);
  const recipes = importResultSchema.parse({ recipes: mapStructuredRecipes(source.text) }).recipes;
  expect(recipes).toHaveLength(2);
  expect(recipes[0]?.servings).toBe(12);
  expect(recipes[0]?.prep_minutes).toBe(15);
  const draft = importToDraft(recipes[0]!, '11111111-1111-4111-8111-111111111111', { name: 'Kilde', text: source.text, url: 'https://example.com/recipe' });
  expect(draft.ingredients[0]?.quantity).toBe(2.5);
  expect(draft.ingredients[0]?.original_text).toBe('2½ dl vand');
  expect(draft.source_url).toBe('https://example.com/recipe');
  expect(draft.source_text).toBe(source.text);
});
it('removes scripts in fallback and does not fabricate incomplete JSON-LD recipes', () => {
  expect(extractRecipeSource('<script>alert(1)</script><p>500 g mel</p>').text).toBe('500 g mel');
  expect(mapStructuredRecipes('[{"name":"Boller"}]')).toBe(null);
  expect(() => importResultSchema.parse({ recipes: [] })).toThrow();
});
