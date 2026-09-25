import next from 'eslint-config-next';
import base from '@vores-kok/config/eslint';

const config = [
  { ignores: ['.next/**', 'next-env.d.ts', 'playwright-report/**', 'test-results/**'] },
  ...next,
  ...base,
];

export default config;
