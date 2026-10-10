import type { MetadataRoute } from 'next';
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/opskrifter', '/om'],
      disallow: ['/admin', '/api', '/login', '/konto'],
    },
    sitemap: (process.env.NEXT_PUBLIC_SITE_URL || 'https://akselsmad.dk') + '/sitemap.xml',
  };
}
