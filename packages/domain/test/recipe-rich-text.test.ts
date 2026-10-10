import { expect, it } from 'vitest';
import { textBlocks, inlineText } from '../../../apps/web/src/lib/recipe-rich-text';
import { textBlocks as publicBlocks, inlineText as publicInline } from '../../../apps/akselsmad/src/lib/rich-text';
it('preserves recipe formatting when copying from AkselsMad to Vores Kok', () => {
  const text = '## Gode raad\n\n- **Fold** dejen\n- *Vent* lidt\n\n3. Bag\n4. Afkoel\n\n> Hold oeje med skorpen\n\nLinje 1\nLinje 2';
  expect(textBlocks(text)).toEqual(publicBlocks(text));
  expect(inlineText('**Lun** og *bloed*')).toEqual(publicInline('**Lun** og *bloed*'));
  expect(textBlocks(text).some(b => b.kind === 'ol' && b.start === 3)).toBe(true);
});
it('keeps HTML and incomplete formatting as ordinary text', () => {
  const text = '<img src=x onerror=alert(1)> **ufuldstaendig';
  expect(textBlocks(text)).toEqual([{ kind: 'paragraph', text }]);
  expect(inlineText(text)).toEqual([{ kind: 'text', text }]);
});
