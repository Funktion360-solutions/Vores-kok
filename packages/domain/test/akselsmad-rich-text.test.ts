import { expect, it } from 'vitest';
import { formatSelection, inlineText, textBlocks } from '../../../apps/akselsmad/src/lib/rich-text';
it('formats a selection and restores the intended caret range', () => {
  expect(formatSelection('Lun dej', 0, 3, 'bold')).toEqual({
    value: '**Lun** dej',
    start: 2,
    end: 5,
  });
  expect(formatSelection('**Lun** dej', 2, 5, 'bold')).toEqual({
    value: 'Lun dej',
    start: 0,
    end: 3,
  });
});
it('formats all selected lines and can remove their list prefixes', () => {
  const list = formatSelection('Udstyr\nSkaal\nSke', 7, 16, 'ol');
  expect(list.value).toBe('Udstyr\n1. Skaal\n2. Ske');
  expect(formatSelection(list.value, list.start, list.end, 'ol').value).toBe('Udstyr\nSkaal\nSke');
});
it('renders lists, emphasis and paragraphs while retaining raw HTML as ordinary text', () => {
  const blocks = textBlocks('## Raad\n\n- **Fold** dejen\n- Vent\n\n<script>alert(1)</script>');
  expect(blocks).toEqual([
    { kind: 'heading', text: 'Raad' },
    { kind: 'ul', items: ['**Fold** dejen', 'Vent'], start: 1 },
    { kind: 'paragraph', text: '<script>alert(1)</script>' },
  ]);
  expect(inlineText('**Fold** og *vent*')).toEqual([
    { kind: 'bold', text: 'Fold' },
    { kind: 'text', text: ' og ' },
    { kind: 'italic', text: 'vent' },
  ]);
});
it('keeps manual ordered list start numbers and plain line breaks', () => {
  expect(textBlocks('3. Fold\n4. Vent\n\nLinje 1\nLinje 2')).toEqual([
    { kind: 'ol', items: ['Fold', 'Vent'], start: 3 },
    { kind: 'paragraph', text: 'Linje 1\nLinje 2' },
  ]);
});
