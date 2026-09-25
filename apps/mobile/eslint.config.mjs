import base from '@vores-kok/config/eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  { ignores: ['dist-ios/**', 'dist-web/**', '.expo/**', 'expo-env.d.ts'] },
  ...base,
  { plugins: { 'react-hooks': reactHooks }, rules: { 'react-hooks/rules-of-hooks': 'error', 'react-hooks/exhaustive-deps': 'warn' } },
];
