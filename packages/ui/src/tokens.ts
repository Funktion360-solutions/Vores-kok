/**
 * Vores Kok design tokens — the single source for web (via tokens.css) and
 * mobile (imported directly). Warm, calm, family-kitchen palette.
 * Contrast of text colours on `paper`/`cream` is ≥ 4.5:1 (WCAG AA).
 */
export const colors = {
  cream: '#FAF6EF',
  paper: '#FFFDF9',
  sand: '#F2EADF',
  line: '#E6DACB',
  ink: '#2A211C',
  inkSoft: '#62554B',
  inkMuted: '#7A6C60',
  terracotta: '#A84B24',
  terracottaDark: '#8C3D1C',
  terracottaSoft: '#F6E4DA',
  sage: '#56663F',
  sageSoft: '#E7ECDD',
  honey: '#B7811F',
  honeySoft: '#F8EDD3',
  danger: '#B3261E',
  dangerSoft: '#FBE3E1',
  white: '#FFFFFF',
} as const;

export const darkColors: Record<keyof typeof colors, string> = {
  cream: '#1C1714',
  paper: '#241E1A',
  sand: '#2E2621',
  line: '#3D332C',
  ink: '#F4ECE3',
  inkSoft: '#D2C4B6',
  inkMuted: '#B2A393',
  terracotta: '#E08A62',
  terracottaDark: '#F0A37F',
  terracottaSoft: '#3A2419',
  sage: '#A9BC8C',
  sageSoft: '#2A3122',
  honey: '#E3B55A',
  honeySoft: '#3A2F17',
  danger: '#F28B82',
  dangerSoft: '#3E1F1C',
  white: '#FFFFFF',
};

export const radii = { sm: 8, md: 12, lg: 18, xl: 26, full: 999 } as const;
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;

export const fontSizes = {
  xs: 12, sm: 14, md: 16, lg: 18, xl: 22, xxl: 28, display: 36,
  /** Cook-mode sizes (Phase 2) — readable from arm's length. */
  cookBody: 26, cookHeading: 34,
} as const;

/** Minimum touch target (Apple HIG 44pt; we use 48 for wet/floury hands). */
export const touchTarget = 48;

export const fonts = {
  display: 'Fraunces',
  body: 'Inter',
} as const;

function kebab(s: string) {
  return s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

/** CSS custom properties for the web app (light + dark). */
export function tokensToCss(): string {
  const light = Object.entries(colors).map(([k, v]) => `  --vk-${kebab(k)}: ${v};`).join('\n');
  const dark = Object.entries(darkColors).map(([k, v]) => `    --vk-${kebab(k)}: ${v};`).join('\n');
  const r = Object.entries(radii).map(([k, v]) => `  --vk-radius-${k}: ${v}px;`).join('\n');
  return `/* GENERATED from packages/ui/src/tokens.ts — run \`pnpm --filter @vores-kok/ui build:css\`. */\n:root {\n${light}\n${r}\n  --vk-touch: ${touchTarget}px;\n}\n@media (prefers-color-scheme: dark) {\n  :root:not([data-theme='light']) {\n${dark}\n  }\n}\n:root[data-theme='dark'] {\n${dark.replace(/^ {4}/gm, '  ')}\n}\n`;
}
