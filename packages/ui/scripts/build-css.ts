import { writeFileSync } from 'node:fs';
import { tokensToCss } from '../src/tokens.ts';

writeFileSync(new URL('../tokens.css', import.meta.url), tokensToCss());
console.log('✓ wrote packages/ui/tokens.css');
