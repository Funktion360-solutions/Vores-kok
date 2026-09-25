import base from '@vores-kok/config/eslint';

// CLI tools print progress to stdout.
export default [...base, { files: ['src/**/*.ts'], rules: { 'no-console': 'off' } }];
