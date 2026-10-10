import type { MetadataRoute } from 'next';
import { publicRecipes } from '@/lib/data';
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = process.env.NEXT_PUBLIC_SITE_URL || 'https://akselsmad.dk';
  return [
    { url: origin },
    { url: origin + '/opskrifter' },
    { url: origin + '/om' },
    ...(await publicRecipes()).map((r) => ({
      url: origin + '/opskrifter/' + r.slug,
      lastModified: r.published_at,
    })),
  ];
}
