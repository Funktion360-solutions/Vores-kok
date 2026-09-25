import type { NextConfig } from 'next';

const config: NextConfig = {
  // Separate build output for E2E runs against the local emulator (different public env).
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  // Shared workspace packages ship TypeScript source.
  transpilePackages: ['@vores-kok/domain', '@vores-kok/validation', '@vores-kok/database', '@vores-kok/ui'],
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(), payment=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
        ],
      },
    ];
  },
};

export default config;
