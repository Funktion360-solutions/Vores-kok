import next from 'eslint-config-next';
import base from '@vores-kok/config/eslint';

export default [
  ...base,
  ...next,
  { ignores: ['.next/**', 'next-env.d.ts', 'playwright-report/**', 'test-results/**'] },
];
