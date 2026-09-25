import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { colors, tokensToCss } from '../src/tokens';

function luminance(hex: string) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
}
function contrast(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x! + 0.05) / (y! + 0.05);
}

describe('tokens', () => {
  it('tokens.css is up to date', () => {
    expect(readFileSync(new URL('../tokens.css', import.meta.url), 'utf8')).toBe(tokensToCss());
  });
  it.each([
    ['ink', 'cream'], ['inkSoft', 'cream'], ['inkMuted', 'paper'], ['terracotta', 'paper'], ['sage', 'paper'], ['danger', 'paper'],
  ] as const)('%s on %s meets AA', (fg, bg) => {
    expect(contrast(colors[fg], colors[bg])).toBeGreaterThanOrEqual(4.5);
  });
  it('white on terracotta meets AA', () => {
    expect(contrast(colors.white, colors.terracotta)).toBeGreaterThanOrEqual(4.5);
  });
});
