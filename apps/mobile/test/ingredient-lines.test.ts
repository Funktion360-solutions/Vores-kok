import { describe, expect, it } from 'vitest';
import * as mod from '../src/lib/ingredient-lines';

describe('ingredient text round-trip', () => {
  const existing = [
    { id: 'a', position: 0, section: 'Dej', quantity: 2.5, quantity_max: null, unit: 'dl', unit_code: 'dl', name: 'mælk', preparation: 'lun', original_text: '2½ dl mælk, lun', is_optional: false, is_scalable: true },
    { id: 'b', position: 1, section: 'Dej', quantity: null, quantity_max: null, unit: null, unit_code: null, name: 'en god klat smør', preparation: null, original_text: 'en god klat smør', is_optional: false, is_scalable: true },
  ];
  it('renders and re-parses without losing ids or wording', () => {
    const text = mod.ingredientsToText(existing);
    expect(text).toBe('Dej:\n2½ dl mælk, lun\nen god klat smør');
    const parsed = mod.linesToIngredients(`${text}\nFyld:\n100 g smør`, existing);
    expect(parsed.map((p) => p.id)).toEqual(['a', 'b', undefined]);
    expect(parsed[2]).toMatchObject({ section: 'Fyld', quantity: 100, unit_code: 'g', name: 'smør' });
    expect(parsed[1]).toMatchObject({ original_text: 'en god klat smør', section: 'Dej' });
  });
});
