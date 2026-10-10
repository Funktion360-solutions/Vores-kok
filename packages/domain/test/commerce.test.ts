import { expect, it } from 'vitest';
import {
  parseOre,
  copenhagenDay,
  offerWeek,
  offerStatus,
  approvedDocumentSchema,
} from '../../validation/src/commerce';
it('handles Danish money without interpreting quantity or negative discounts as positive prices', () => {
  expect(parseOre('19,95')).toBe(1995);
  expect(parseOre('-5,00')).toBe(-500);
  expect(parseOre('0')).toBe(0);
  expect(parseOre('')).toBeNull();
  expect(() => parseOre('19,999')).toThrow();
  expect(() => parseOre('1e3')).toThrow();
});
it('uses the Copenhagen calendar and Wednesday cache window across midnight', () => {
  expect(copenhagenDay(new Date('2026-10-06T22:30:00Z'))).toBe('2026-10-07');
  expect(offerWeek('2026-10-07')).toBe('2026-10-07');
  expect(offerWeek('2026-10-13')).toBe('2026-10-07');
  expect(offerWeek('2026-10-14')).toBe('2026-10-14');
});
it('expires offers only after their last day and distinguishes unknown and future windows', () => {
  expect(offerStatus(null, '2026-10-10', '2026-10-10')).toBe('active');
  expect(offerStatus(null, '2026-10-10', '2026-10-11')).toBe('expired');
  expect(offerStatus('2026-10-12', '2026-10-20', '2026-10-10')).toBe('future');
  expect(offerStatus(null, null, '2026-10-10')).toBe('unknown');
});
it('does not allow unconfirmed currency or missing approved line identities', () => {
  expect(
    approvedDocumentSchema.safeParse({
      store: null,
      date: null,
      currency: null,
      total_ore: null,
      lines: [],
      warnings: [],
    }).success,
  ).toBe(false);
});
